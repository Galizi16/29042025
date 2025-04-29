import { formatDateYYYYMMDD } from './utils.js';
import {
    getBaseRates,
    getTravcoBaseRates,
    ABSOLUTE_BASE_CATEGORY_NAME,
    BASE_RATE_PLAN_NAME,
    TRAVCO_BASE_CATEGORY,
    TRAVCO_BASE_PLAN,
    ratePlanDescriptions // Nécessaire pour les logs de warning si plan inconnu
} from './api.js';


/**
 * Trouve le tarif de base OTA (Double Classique) pour une date donnée.
 * Utilise les données chargées via l'API.
 * @param {Date} requestedDate Objet Date UTC.
 * @returns {number|null} Le tarif ou null si non trouvé/invalide.
 */
function findAbsoluteOtaBaseRate(requestedDate) {
    const baseRatesByDate = getBaseRates(); // Accès aux données via API module
    if (!(requestedDate instanceof Date) || isNaN(requestedDate.getTime())) { return null; }
    const requestedDateStr = formatDateYYYYMMDD(requestedDate);
    if (!requestedDateStr || !baseRatesByDate.has(requestedDateStr)) {
        return null; // Pas de date ou pas de tarif trouvé pour cette date
    }
    const rate = baseRatesByDate.get(requestedDateStr);
    // Vérifie si la valeur est un nombre valide et positif
    if (rate !== null && typeof rate === 'number' && !isNaN(rate) && rate >= 0) {
         return rate;
    } else {
         console.warn(`CALCUL: findAbsoluteOtaBaseRate: Valeur invalide (${rate}) pour ${requestedDateStr} dans baseRatesByDate.`);
         return null; // Valeur invalide
    }
}

/**
 * Trouve le tarif de base Travco (Double Classique) pour une date donnée.
 * Utilise les données chargées via l'API.
 * @param {Date} requestedDate Objet Date UTC.
 * @returns {number|null} Le tarif ou null si non trouvé/invalide.
 */
function findAbsoluteTravcoBaseRate(requestedDate) {
    const travcoBaseRatesByDate = getTravcoBaseRates(); // Accès aux données via API module
    if (!(requestedDate instanceof Date) || isNaN(requestedDate.getTime())) { return null; }
    const requestedDateStr = formatDateYYYYMMDD(requestedDate);
    if (!requestedDateStr || !travcoBaseRatesByDate.has(requestedDateStr)) {
        return null;
    }
    const rate = travcoBaseRatesByDate.get(requestedDateStr);
    if (rate !== null && typeof rate === 'number' && !isNaN(rate) && rate >= 0) {
         return rate;
    } else {
         console.warn(`CALCUL: findAbsoluteTravcoBaseRate: Valeur invalide (${rate}) pour ${requestedDateStr} dans travcoBaseRatesByDate.`);
         return null;
    }
}


/**
 * Calcule le tarif journalier final pour une catégorie et un plan donnés,
 * en fonction du tarif de base absolu (OTA ou Travco) du jour.
 * @param {Date} date La date UTC pour laquelle calculer le tarif.
 * @param {string} requestedCategory La catégorie de chambre demandée.
 * @param {string} requestedPlan Le plan tarifaire demandé.
 * @returns {number|null} Le tarif journalier calculé et arrondi, ou null en cas d'erreur critique (ex: tarif base manquant).
 */
export function calculateDailyRate(date, requestedCategory, requestedPlan) {

    // --- Logique Spécifique TRAVCO ---
    if (requestedPlan && requestedPlan.startsWith('TRAVCO-')) {
        const travcoBaseRateDoubleClassique = findAbsoluteTravcoBaseRate(date);

        if (travcoBaseRateDoubleClassique === null) {
             // console.warn(`CALCUL: Tarif base TRAVCO (${TRAVCO_BASE_PLAN} / ${TRAVCO_BASE_CATEGORY}) manquant pour ${formatDateYYYYMMDD(date)}. Impossible de calculer.`);
             return null; // Important de retourner null si base manque
        }

        let travcoFlexRateForCategory = travcoBaseRateDoubleClassique;

        // Appliquer les suppléments fixes par catégorie (selon règles fournies)
        switch (requestedCategory) {
            case 'Double Classique': travcoFlexRateForCategory = travcoBaseRateDoubleClassique; break;
            case 'Double Single Use Classique': travcoFlexRateForCategory = travcoBaseRateDoubleClassique - 10; break;
            case 'Twin Classique': travcoFlexRateForCategory = travcoBaseRateDoubleClassique + 10; break;
            case 'Double Classique Terrasse': travcoFlexRateForCategory = travcoBaseRateDoubleClassique + 50; break;
            case 'Double Deluxe': travcoFlexRateForCategory = travcoBaseRateDoubleClassique + 50; break;
            case 'Twin Deluxe': travcoFlexRateForCategory = travcoBaseRateDoubleClassique + 60; break;
            case 'Double Deluxe Terrasse': travcoFlexRateForCategory = travcoBaseRateDoubleClassique + 100; break;
            case 'Deux Chambres Adjacentes 4 personnes': travcoFlexRateForCategory = (travcoBaseRateDoubleClassique * 2) + 10; break;
            default:
                console.warn(`CALCUL: Catégorie inconnue pour TRAVCO: '${requestedCategory}'. Utilisation tarif Double Classique.`);
                travcoFlexRateForCategory = travcoBaseRateDoubleClassique;
                break;
        }

        // Appliquer la règle NANR si nécessaire
        let finalTravcoRate = travcoFlexRateForCategory;
        if (requestedPlan.includes('-NANR-')) { // Gère TRAVCO-BB-NANR-NET
            finalTravcoRate = travcoFlexRateForCategory * 0.95;
        }

        return Math.round(finalTravcoRate * 100) / 100; // Arrondi final

    } else {
        // --- Logique Standard (Non-Travco) ---
        const absoluteOtaBaseRateForDay = findAbsoluteOtaBaseRate(date);

        if (absoluteOtaBaseRateForDay === null) {
             // console.warn(`CALCUL: Tarif base OTA (${BASE_RATE_PLAN_NAME} / ${ABSOLUTE_BASE_CATEGORY_NAME}) manquant pour ${formatDateYYYYMMDD(date)}. Impossible de calculer.`);
            return null; // Important de retourner null si base manque
        }
        const baseRateDoubleClassique = parseFloat(absoluteOtaBaseRateForDay);

        // Calculer le tarif OTA-RO-FLEX pour la catégorie demandée
        let categoryOtaRoFlexRate = baseRateDoubleClassique;
        switch (requestedCategory) {
            case 'Double Classique': case 'Double Single Use Classique': categoryOtaRoFlexRate = baseRateDoubleClassique; break;
            case 'Twin Classique': categoryOtaRoFlexRate = baseRateDoubleClassique + 10; break;
            case 'Double Classique Terrasse': categoryOtaRoFlexRate = baseRateDoubleClassique + 50; break;
            case 'Double Deluxe': categoryOtaRoFlexRate = baseRateDoubleClassique + 70; break;
            case 'Twin Deluxe': categoryOtaRoFlexRate = baseRateDoubleClassique + 80; break;
            case 'Double Deluxe Terrasse': categoryOtaRoFlexRate = baseRateDoubleClassique + 120; break;
            case 'Deux Chambres Adjacentes 4 personnes': categoryOtaRoFlexRate = (baseRateDoubleClassique * 2) + 60; break;
            default:
                console.warn(`CALCUL: Catégorie standard inconnue: '${requestedCategory}'. Utilisation tarif Double Classique.`);
                categoryOtaRoFlexRate = baseRateDoubleClassique;
                break;
        }
        categoryOtaRoFlexRate = Math.round(categoryOtaRoFlexRate * 100) / 100; // Arrondi intermédiaire

        // Appliquer les formules spécifiques au plan tarifaire demandé
        let finalRate = categoryOtaRoFlexRate; // Base de départ
        const plan = requestedPlan; // Alias pour lisibilité

        // Variables intermédiaires basées sur categoryOtaRoFlexRate (pour TO/HB/HOTUSA etc.)
        const toRoNet = categoryOtaRoFlexRate * 0.83;
        const toRoNanrNet = (categoryOtaRoFlexRate * 0.95) * 0.83;
        const hbRoBrut = toRoNet * 1.252;
        const toRoNanrBrut = hbRoBrut * 0.95; // Calculé à partir de HB Brut Flex

        switch (plan) {
            // --- Plans basés sur OTA ---
            case 'OTA-RO-FLEX': finalRate = categoryOtaRoFlexRate; break;
            case 'OTA-RO-NANR': finalRate = categoryOtaRoFlexRate * 0.95; break;
            case 'OTA-BB-FLEX-1P': finalRate = categoryOtaRoFlexRate + 15; break;
            case 'OTA-BB-FLEX-2P': finalRate = categoryOtaRoFlexRate + 30; break;
            case 'OTA-BB-FLEX-4P': finalRate = categoryOtaRoFlexRate + 60; break;
            case 'OTA-BB-NANR-1P': finalRate = (categoryOtaRoFlexRate * 0.95) + 15; break;
            case 'OTA-BB-NANR-2P': finalRate = (categoryOtaRoFlexRate * 0.95) + 30; break;
            case 'OTA-BB-NANR-4P': finalRate = (categoryOtaRoFlexRate * 0.95) + 60; break;

            // --- Plans MOBILE (-10% sur OTA correspondant) ---
            case 'MOBILE-RO-FLEX': finalRate = categoryOtaRoFlexRate * 0.90; break;
            case 'MOBILE-RO-NANR': finalRate = (categoryOtaRoFlexRate * 0.95) * 0.90; break;
            case 'MOBILE-BB-FLEX-1P': case 'MOBILE-BB-FLEX-1-P': finalRate = (categoryOtaRoFlexRate + 15) * 0.90; break;
            case 'MOBILE-BB-FLEX-2P': finalRate = (categoryOtaRoFlexRate + 30) * 0.90; break;
            case 'MOBILE-BB-FLEX-4P': finalRate = (categoryOtaRoFlexRate + 60) * 0.90; break;
            case 'MOBILE-BB-NANR-1P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 15) * 0.90; break;
            case 'MOBILE-BB-NANR-2P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 30) * 0.90; break;
            case 'MOBILE-BB-NANR-4P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 60) * 0.90; break;

            // --- Plans VIP (-15% sur OTA correspondant) ---
            case 'VIP-RATE-FLEX': case 'VIP-RO-FLEX': finalRate = categoryOtaRoFlexRate * 0.85; break;
            case 'VIP-RO-NANR': finalRate = (categoryOtaRoFlexRate * 0.95) * 0.85; break;
            case 'VIP-BB-FLEX-1P': finalRate = (categoryOtaRoFlexRate + 15) * 0.85; break;
            case 'VIP-BB-FLEX-2P': finalRate = (categoryOtaRoFlexRate + 30) * 0.85; break;
            case 'VIP-BB-FLEX-4P': finalRate = (categoryOtaRoFlexRate + 60) * 0.85; break;
            case 'VIP-BB-NANR-1P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 15) * 0.85; break;
            case 'VIP-BB-NANR-2P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 30) * 0.85; break;
            case 'VIP-BB-NANR-4P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 60) * 0.85; break;

            // --- Plans TO/HB ---
            case 'TO-RO-FLEX-NET': finalRate = toRoNet; break;
            case 'TO-RO-NANR-NET': finalRate = toRoNanrNet; break;
            case 'HB-RO-FLEX-BRUT': finalRate = hbRoBrut; break;
            case 'TO-RO-NANR-BRUT': finalRate = toRoNanrBrut; break; // basé sur hbRoBrut * 0.95

            case 'TO-BB-FLEX-NET-1P': finalRate = (categoryOtaRoFlexRate + 15) * 0.83; break;
            case 'TO-BB-FLEX-NET-2P': finalRate = (categoryOtaRoFlexRate + 30) * 0.83; break;
            case 'TO-BB-FLEX-NET-4P': finalRate = (categoryOtaRoFlexRate + 60) * 0.83; break;
            case 'TO-BB-NANR-NET-1P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 15) * 0.83; break;
            case 'TO-BB-NANR-NET-2P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 30) * 0.83; break;
            case 'TO-BB-NANR-NET-4P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 60) * 0.83; break;

            case 'TO-BB-FLEX-BRUT-1P': finalRate = ((categoryOtaRoFlexRate + 15) * 0.83) * 1.252; break;
            case 'TO-BB-FLEX-BRUT-2P': finalRate = ((categoryOtaRoFlexRate + 30) * 0.83) * 1.252; break;
            case 'TO-BB-FLEX-BRUT-4P': finalRate = ((categoryOtaRoFlexRate + 60) * 0.83) * 1.252; break;
            case 'TO-BB-NANR-BRUT-1P': finalRate = (((categoryOtaRoFlexRate * 0.95) + 15) * 0.83) * 1.252; break;
            case 'TO-BB-NANR-BRUT-2P': finalRate = (((categoryOtaRoFlexRate * 0.95) + 30) * 0.83) * 1.252; break;
            case 'TO-BB-NANR-BRUT-4P': finalRate = (((categoryOtaRoFlexRate * 0.95) + 60) * 0.83) * 1.252; break;

            // --- Plans HOTUSA (TO NET * 1.31) ---
            case 'HOTUSA-RO-FLEX': finalRate = toRoNet * 1.31; break;
            case 'HOTUSA-RO-NANR': finalRate = toRoNanrNet * 1.31; break;
            case 'HOTUSA-BB-FLEX-1P': finalRate = ((categoryOtaRoFlexRate + 15) * 0.83) * 1.31; break;
            case 'HOTUSA-BB-FLEX-2P': finalRate = ((categoryOtaRoFlexRate + 30) * 0.83) * 1.31; break;
            case 'HOTUSA-BB-FLEX-4P': finalRate = ((categoryOtaRoFlexRate + 60) * 0.83) * 1.31; break;
            case 'HOTUSA-BB-NANR-1P': finalRate = (((categoryOtaRoFlexRate * 0.95) + 15) * 0.83) * 1.31; break;
            case 'HOTUSA-BB-NANR-2P': finalRate = (((categoryOtaRoFlexRate * 0.95) + 30) * 0.83) * 1.31; break;
            case 'HOTUSA-BB-NANR-4P': finalRate = (((categoryOtaRoFlexRate * 0.95) + 60) * 0.83) * 1.31; break;

            // --- Plans FB CORPO (Comme OTA) ---
            case 'FB-CORPO-RO-FLEX': finalRate = categoryOtaRoFlexRate; break;
            case 'FB-CORPO-BB-FLEX-1P': finalRate = categoryOtaRoFlexRate + 15; break;
            case 'FB-CORPO-BB-FLEX-2P': finalRate = categoryOtaRoFlexRate + 30; break;
            case 'FB-CORPO-BB-FLEX-4P': finalRate = categoryOtaRoFlexRate + 60; break;

            // --- Plans GDS/Autres ---
            case 'AMEX-GBT': case 'AMEX-GBT - AMEX GBT': finalRate = categoryOtaRoFlexRate * 0.85; break; // Comme VIP RO FLEX
            case 'CWT-BB-FLEX': finalRate = (categoryOtaRoFlexRate * 0.95) + 15; break; // Comme OTA BB NANR 1P

             // --- Plans PKG EXP (-10% sur OTA, comme MOBILE) ---
            case 'PKG-EXP-RO-FLEX': finalRate = categoryOtaRoFlexRate * 0.90; break;
            case 'PKG-EXP-RO-NANR': finalRate = (categoryOtaRoFlexRate * 0.95) * 0.90; break;
            case 'PKG-EXP-BB-FLEX-1P': finalRate = (categoryOtaRoFlexRate + 15) * 0.90; break;
            case 'PKG-EXP-BB-FLEX-2P': finalRate = (categoryOtaRoFlexRate + 30) * 0.90; break;
            case 'PKG-EXP-BB-FLEX-4P': finalRate = (categoryOtaRoFlexRate + 60) * 0.90; break;
            case 'PKG-EXP-BB-NANR-1P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 15) * 0.90; break;
            case 'PKG-EXP-BB-NANR-2P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 30) * 0.90; break;
            case 'PKG-EXP-BB-NANR-4P': finalRate = ((categoryOtaRoFlexRate * 0.95) + 60) * 0.90; break; // <-- CORRECTION APPLIQUÉE

             // --- Plans PROMO TO (-10% sur TO NET) ---
            case 'PROMO-TO-RO-FLEX': finalRate = toRoNet * 0.9; break;
            case 'PROMO-TO-RO-NANR': finalRate = toRoNanrNet * 0.9; break;
            case 'PROMO-TO-BB-1-FLEX': case 'PROMO-TO-BB-1P-FLEX': finalRate = ((categoryOtaRoFlexRate + 15) * 0.83) * 0.9; break;
            case 'PROMO-TO-BB-1P-NANR': finalRate = (((categoryOtaRoFlexRate * 0.95) + 15) * 0.83) * 0.9; break;
            case 'PROMO-TO-BB-2P-FLEX': finalRate = ((categoryOtaRoFlexRate + 30) * 0.83) * 0.9; break;
            case 'PROMO-TO-BB-2P-NANR': finalRate = (((categoryOtaRoFlexRate * 0.95) + 30) * 0.83) * 0.9; break;
            case 'PROMO-TO-BB-4P-FLEX': finalRate = ((categoryOtaRoFlexRate + 60) * 0.83) * 0.9; break;
            case 'PROMO-TO-BB-4P-NANR': finalRate = (((categoryOtaRoFlexRate * 0.95) + 60) * 0.83) * 0.9; break;

             // --- Plans PROMO HB (-10% sur HB BRUT) ---
            case 'PROMO-HB-RO-FLEX': finalRate = hbRoBrut * 0.9; break;
            case 'PROMO-HB-RO-NANR': finalRate = toRoNanrBrut * 0.9; break; // Basé sur TO RO NANR Brut * 0.9
            case 'PROMO-HB-BB-FLEX-1P': finalRate = (((categoryOtaRoFlexRate + 15) * 0.83) * 1.252) * 0.9; break;
            case 'PROMO-HB-BB-FLEX-2P': finalRate = (((categoryOtaRoFlexRate + 30) * 0.83) * 1.252) * 0.9; break;
            case 'PROMO-HB-BB-FLEX-4P': finalRate = (((categoryOtaRoFlexRate + 60) * 0.83) * 1.252) * 0.9; break;
            case 'PROMO-HB-BB-NANR-1P': finalRate = ((((categoryOtaRoFlexRate * 0.95) + 15) * 0.83) * 1.252) * 0.9; break;
            case 'PROMO-HB-BB-NANR-2P': finalRate = ((((categoryOtaRoFlexRate * 0.95) + 30) * 0.83) * 1.252) * 0.9; break;
            case 'PROMO-HB-BB-NANR-4P': finalRate = ((((categoryOtaRoFlexRate * 0.95) + 60) * 0.83) * 1.252) * 0.9; break;

            default:
                console.warn(`CALCUL: Plan tarifaire standard inconnu ou non géré: '${plan}'. Utilisation du tarif OTA-RO-FLEX de la catégorie (${categoryOtaRoFlexRate}).`);
                finalRate = categoryOtaRoFlexRate; // Fallback
                break;
        }

        // Arrondi final
        return Math.round(finalRate * 100) / 100;
    } // Fin du else (Logique Standard)
} // Fin de la fonction calculateDailyRate