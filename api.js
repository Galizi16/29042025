// --- START OF FILE api.js ---
import { showAppMessage } from './utils.js';

// ==========================================================================
// ==                          CONFIGURATION API                           ==
// ==========================================================================
const API_CONFIG = {
    // !! IMPORTANT !!
    // REMPLACE CETTE URL PAR CELLE OBTENUE APRÈS LE DÉPLOIEMENT DE TON SCRIPT GOOGLE APPS (Code.gs)
    // Le format sera : https://script.google.com/macros/s/VOTRE_ID_DEPLOIEMENT/exec
    // Cette URL est censée fournir toutes les données nécessaires (base rates, structure, partners)
    apiUrl: 'https://script.google.com/macros/s/AKfycbyeP_sn8L_2g7f_R7wcDPBsbuyNbtMWJWmPZIXRWDEgUROdj2I5eS8wMKVixOpeSjYxhg/exec', // <--- METS TON URL ICI !
};
const sheetDataCache = {
    timestamp: null,
    data: null, // Contiendra { baseRates:{}, travcoBaseRates:{}, tariffStructure:[], partners:[] }
    ttl: 15 * 60 * 1000 // Cache de 15 minutes en millisecondes
};

// Références pour calculs (partagées)
export const ABSOLUTE_BASE_CATEGORY_NAME = 'Double Classique'; // Utilisé pour les tarifs de base OTA
export const BASE_RATE_PLAN_NAME = 'OTA-RO-FLEX'; // Le plan de référence OTA
export const TRAVCO_BASE_CATEGORY = 'Double Classique'; // Référence pour les calculs Travco
export const TRAVCO_BASE_PLAN = 'TRAVCO-BB-FLEX-NET'; // Le plan de référence Travco

// Descriptions des plans pour l'aide contextuelle (partagées)
export const ratePlanDescriptions = {
    'OTA-RO-FLEX': 'Chambre Seule, Flexible',
    'OTA-RO-NANR': 'Chambre Seule, Non-Annulable',
    'OTA-BB-FLEX-1P': 'Petit Déj. inclus (1p), Flexible',
    'OTA-BB-FLEX-2P': 'Petit Déj. inclus (2p), Flexible',
    'OTA-BB-FLEX-4P': 'Petit Déj. inclus (4p), Flexible',
    'OTA-BB-NANR-1P': 'Petit Déj. inclus (1p), Non-Annulable',
    'OTA-BB-NANR-2P': 'Petit Déj. inclus (2p), Non-Annulable',
    'OTA-BB-NANR-4P': 'Petit Déj. inclus (4p), Non-Annulable',
    'MOBILE-RO-FLEX': 'Mobile - Chambre Seule, Flexible',
    'MOBILE-RO-NANR': 'Mobile - Chambre Seule, Non-Annulable',
    'MOBILE-BB-FLEX-1-P': 'Mobile - Petit Déj. inclus (1p), Flexible',
    'MOBILE-BB-FLEX-1P': 'Mobile - Petit Déj. inclus (1p), Flexible',
    'MOBILE-BB-FLEX-2P': 'Mobile - Petit Déj. inclus (2p), Flexible',
    'MOBILE-BB-FLEX-4P': 'Mobile - Petit Déj. inclus (4p), Flexible',
    'MOBILE-BB-NANR-1P': 'Mobile - Petit Déj. inclus (1p), Non-Annulable',
    'MOBILE-BB-NANR-2P': 'Mobile - Petit Déj. inclus (2p), Non-Annulable',
    'MOBILE-BB-NANR-4P': 'Mobile - Petit Déj. inclus (4p), Non-Annulable',
    'VIP-RATE-FLEX': 'VIP - Chambre Seule, Flexible',
    'VIP-RO-FLEX': 'VIP - Chambre Seule, Flexible', // Alias
    'VIP-RO-NANR': 'VIP - Chambre Seule, Non-Annulable',
    'VIP-BB-FLEX-1P': 'VIP - Petit Déj. inclus (1p), Flexible',
    'VIP-BB-FLEX-2P': 'VIP - Petit Déj. inclus (2p), Flexible',
    'VIP-BB-FLEX-4P': 'VIP - Petit Déj. inclus (4p), Flexible',
    'VIP-BB-NANR-1P': 'VIP - Petit Déj. inclus (1p), Non-Annulable',
    'VIP-BB-NANR-2P': 'VIP - Petit Déj. inclus (2p), Non-Annulable',
    'VIP-BB-NANR-4P': 'VIP - Petit Déj. inclus (4p), Non-Annulable',
    'HB-RO-FLEX-BRUT': 'Hotelbeds RO Flex Brut',
    'TO-RO-FLEX-NET': 'TO RO Flex Net',
    'TO-RO-NANR-BRUT': 'TO RO NANR Brut',
    'TO-RO-NANR-NET': 'TO RO NANR Net',
    'TO-BB-FLEX-BRUT-1P': 'TO BB Flex Brut 1P',
    'TO-BB-FLEX-BRUT-2P': 'TO BB Flex Brut 2P',
    'TO-BB-FLEX-BRUT-4P': 'TO BB Flex Brut 4P',
    'TO-BB-NANR-BRUT-1P': 'TO BB NANR Brut 1P',
    'TO-BB-NANR-BRUT-2P': 'TO BB NANR Brut 2P',
    'TO-BB-NANR-BRUT-4P': 'TO BB NANR Brut 4P',
    'TO-BB-FLEX-NET-1P': 'TO BB Flex Net 1P',
    'TO-BB-FLEX-NET-2P': 'TO BB Flex Net 2P',
    'TO-BB-FLEX-NET-4P': 'TO BB Flex Net 4P',
    'TO-BB-NANR-NET-1P': 'TO BB NANR Net 1P',
    'TO-BB-NANR-NET-2P': 'TO BB NANR Net 2P',
    'TO-BB-NANR-NET-4P': 'TO BB NANR Net 4P',
    'HOTUSA-RO-FLEX': 'Hotusa RO Flex',
    'HOTUSA-RO-NANR': 'Hotusa RO NANR',
    'HOTUSA-BB-FLEX-1P': 'Hotusa BB Flex 1P',
    'HOTUSA-BB-FLEX-2P': 'Hotusa BB Flex 2P',
    'HOTUSA-BB-FLEX-4P': 'Hotusa BB Flex 4P',
    'HOTUSA-BB-NANR-1P': 'Hotusa BB NANR 1P',
    'HOTUSA-BB-NANR-2P': 'Hotusa BB NANR 2P',
    'HOTUSA-BB-NANR-4P': 'Hotusa BB NANR 4P',
    'FB-CORPO-RO-FLEX': 'FB Corpo RO Flex',
    'FB-CORPO-BB-FLEX-1P': 'FB Corpo BB Flex 1P',
    'FB-CORPO-BB-FLEX-2P': 'FB Corpo BB Flex 2P',
    'FB-CORPO-BB-FLEX-4P': 'FB Corpo BB Flex 4P',
    'AMEX-GBT': 'AMEX GBT',
    'AMEX-GBT - AMEX GBT': 'AMEX GBT (Alt)',
    'CWT-BB-FLEX': 'CWT BB Flex',
    'PKG-EXP-RO-FLEX': 'Package Expedia RO Flex',
    'PKG-EXP-RO-NANR': 'Package Expedia RO NANR',
    'PKG-EXP-BB-FLEX-1P': 'Package Expedia BB Flex 1P',
    'PKG-EXP-BB-FLEX-2P': 'Package Expedia BB Flex 2P',
    'PKG-EXP-BB-FLEX-4P': 'Package Expedia BB Flex 4P',
    'PKG-EXP-BB-NANR-1P': 'Package Expedia BB NANR 1P',
    'PKG-EXP-BB-NANR-2P': 'Package Expedia BB NANR 2P',
    'PKG-EXP-BB-NANR-4P': 'Package Expedia BB NANR 4P',
    'PROMO-TO-RO-FLEX': 'Promo TO RO Flex',
    'PROMO-TO-RO-NANR': 'Promo TO RO NANR',
    'PROMO-TO-BB-1-FLEX': 'Promo TO BB 1P Flex',
    'PROMO-TO-BB-1P-FLEX': 'Promo TO BB 1P Flex', // Alias
    'PROMO-TO-BB-1P-NANR': 'Promo TO BB 1P NANR',
    'PROMO-TO-BB-2P-FLEX': 'Promo TO BB 2P Flex',
    'PROMO-TO-BB-2P-NANR': 'Promo TO BB 2P NANR',
    'PROMO-TO-BB-4P-FLEX': 'Promo TO BB 4P Flex',
    'PROMO-TO-BB-4P-NANR': 'Promo TO BB 4P NANR',
    'PROMO-HB-RO-FLEX': 'Promo HB RO Flex',
    'PROMO-HB-RO-NANR': 'Promo HB RO NANR',
    'PROMO-HB-BB-FLEX-1P': 'Promo HB BB Flex 1P',
    'PROMO-HB-BB-FLEX-2P': 'Promo HB BB Flex 2P',
    'PROMO-HB-BB-FLEX-4P': 'Promo HB BB Flex 4P',
    'PROMO-HB-BB-NANR-1P': 'Promo HB BB NANR 1P',
    'PROMO-HB-BB-NANR-2P': 'Promo HB BB NANR 2P',
    'PROMO-HB-BB-NANR-4P': 'Promo HB BB NANR 4P',
    'TRAVCO-BB-FLEX-NET': 'Travco BB Flex Net',
    'TRAVCO-BB-NANR-NET': 'Travco BB NANR Net',
};
// --- Fin Configuration API ---


// --- Structures globales pour les données chargées ---
let baseRatesByDate = new Map(); // Map: 'YYYY-MM-DD' -> rate (OTA-RO-FLEX Double Classique)
let travcoBaseRatesByDate = new Map(); // Map: 'YYYY-MM-DD' -> rate (TRAVCO-BB-FLEX-NET Double Classique)
let partnerToPlansMap = new Map(); // Map: PartnerName -> Set<PlanCode>
let planToCategoriesMap = new Map(); // Map: PlanCode -> Set<CategoryName>
let categoryToPlansMap = new Map(); // Map: CategoryName -> Set<PlanCode>
let allPartners = new Set();
let allCategories = new Set();
let allPlans = new Set();
let originalPlanOrder = {}; // Map: CategoryName -> Array<PlanCode> (pour conserver l'ordre d'affichage)


/**
 * Vide les structures de données chargées.
 */
function clearAppData() {
    baseRatesByDate.clear();
    travcoBaseRatesByDate.clear();
    partnerToPlansMap.clear();
    planToCategoriesMap.clear();
    categoryToPlansMap.clear();
    allPartners.clear();
    allCategories.clear();
    allPlans.clear();
    originalPlanOrder = {};
    console.log("APP_DATA: Données globales effacées.");
}

/**
 * Traite les données brutes reçues de l'API et peuple les structures globales.
 * @param {object} data Les données reçues de l'API.
 * @throws Error si le format des données est invalide.
 */
function processFetchedData(data) {
    console.log("APP_DATA: Début du traitement des données reçues...");
    clearAppData(); // Vide les structures avant de remplir

    // 1. Process Base Rates (OTA)
    if (data.baseRates && typeof data.baseRates === 'object') {
         baseRatesByDate = new Map(Object.entries(data.baseRates));
         console.log(`APP_DATA: Map baseRatesByDate (OTA) créée avec ${baseRatesByDate.size} entrées.`);
    } else {
         console.warn("APP_DATA: Données baseRates (OTA) manquantes ou invalides.");
    }

    // 2. Process Base Rates (Travco)
    if (data.travcoBaseRates && typeof data.travcoBaseRates === 'object') {
         travcoBaseRatesByDate = new Map(Object.entries(data.travcoBaseRates));
         console.log(`APP_DATA: Map travcoBaseRatesByDate créée avec ${travcoBaseRatesByDate.size} entrées.`);
    } else {
         console.warn("APP_DATA: Données travcoBaseRates manquantes ou invalides.");
    }

    // 3. Process Tariff Structure [Category, PlanCode]
    const structureData = data.tariffStructure || [];
    if (structureData.length > 0) {
        structureData.forEach(row => {
            if (!row || row.length < 2) return; // Ignore lignes invalides
            const category = String(row[0] || '').trim();
            const plan = String(row[1] || '').trim();

            if (category && plan) {
                allCategories.add(category);
                allPlans.add(plan);

                // Map Catégorie -> Plans (avec ordre)
                if (!categoryToPlansMap.has(category)) {
                    categoryToPlansMap.set(category, new Set());
                    originalPlanOrder[category] = []; // Initialise l'ordre pour cette catégorie
                }
                if (!categoryToPlansMap.get(category).has(plan)) {
                    categoryToPlansMap.get(category).add(plan);
                    originalPlanOrder[category].push(plan); // Ajoute à la fin pour conserver l'ordre
                }

                // Map Plan -> Catégories
                if (!planToCategoriesMap.has(plan)) {
                    planToCategoriesMap.set(plan, new Set());
                }
                planToCategoriesMap.get(plan).add(category);
            }
        });
    }
    console.log(`APP_DATA: ${allCategories.size} Catégories trouvées:`, [...allCategories].sort());
    console.log(`APP_DATA: ${allPlans.size} Plans trouvés.`);

    // 4. Process Partner Data [PartnerName, PlanCode]
    const partnerData = data.partners || [];
    let missingPlanWarnings = new Set(); // Pour éviter répétition console
    if (partnerData.length > 0) {
        partnerData.forEach(row => {
             if (!row || row.length < 2) return; // Ignore lignes invalides
             const partnerName = String(row[0] || '').trim();
             const planCode = String(row[1] || '').trim();

             if (partnerName && planCode) {
                 allPartners.add(partnerName);

                 if (!partnerToPlansMap.has(partnerName)) {
                     partnerToPlansMap.set(partnerName, new Set());
                 }

                 // Vérifie si le plan existe dans la structure tarifaire
                 if (allPlans.has(planCode)) {
                    partnerToPlansMap.get(partnerName).add(planCode);
                 } else {
                     // Affiche un avertissement seulement une fois par plan manquant
                     if (!missingPlanWarnings.has(planCode)) {
                         console.warn(`APP_DATA: Plan '${planCode}' (associé à '${partnerName}') non trouvé dans la structure tarifs globale. Association ignorée.`);
                         missingPlanWarnings.add(planCode);
                     }
                 }
             }
        });
    }
     if (missingPlanWarnings.size > 0) {
        // Note: L'affichage des alertes se fera dans la fonction appelante (loadAppData)
     }
    console.log(`APP_DATA: ${allPartners.size} Partenaires trouvés:`, [...allPartners].sort());
    console.log("APP_DATA: Traitement des données terminé.");

    return { missingPlanWarningsCount: missingPlanWarnings.size }; // Retourne le nombre d'avertissements
}


/**
 * Charge toutes les données nécessaires depuis l'API Google Apps Script.
 * Gère le cache et l'affichage des messages de chargement/erreur.
 * @param {string} messageAreaId L'ID de la zone où afficher les messages.
 * @returns {Promise<boolean>} Resolves true si le chargement réussit, false si les données sont indisponibles (erreur critique). Rejette si erreur non gérée.
 */
export async function loadAppData(messageAreaId) {
    const now = Date.now();
    if (sheetDataCache.data && sheetDataCache.timestamp && (now - sheetDataCache.timestamp < sheetDataCache.ttl)) {
        console.log("APP_DATA: Utilisation données cache.");
        showAppMessage(messageAreaId, "Données Google Sheets chargées depuis le cache.", "info", 3000); // Message rapide pour l'utilisateur
        return true; // Succès
    }

    console.log("APP_DATA: Appel Apps Script pour toutes les données...");
    showAppMessage(messageAreaId, "Chargement des données de tarifs depuis Google Sheets...", "info", 0); // 0 = pas de disparition auto

    if (!API_CONFIG.apiUrl || API_CONFIG.apiUrl.includes('VOTRE_ID_DEPLOIEMENT')) {
        const errorMsg = "URL API non configurée ! Déploie ton script Google Apps et colle l'URL.";
        showAppMessage(messageAreaId, errorMsg, 'error', 0); // Message persistant
        // Pas d'exception levée ici, car l'erreur est gérée côté UI
        return false; // Échec critique
    }

    try {
        const url = `${API_CONFIG.apiUrl}?action=getAllData&t=${Date.now()}`; // Ajout timestamp pour éviter cache navigateur agressif
        console.log(`APP_DATA: Fetching: ${url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // Timeout 60s

        const response = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        // Enlève le message "Chargement..."
        const loadingMessageElement = document.querySelector(`#${messageAreaId} .alert-info`);
        if (loadingMessageElement) { loadingMessageElement.remove(); }

        if (!response.ok) {
            let errorText = `Erreur ${response.status} ${response.statusText}`;
            try {
                const errorBody = await response.text(); console.error("APP_DATA: Réponse erreur brute:", errorBody);
                errorText += ` - ${errorBody.substring(0, 300)}`;
            } catch (e) { /* ignore si lecture body échoue */ }
            throw new Error(`Erreur API (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log("APP_DATA: Données brutes reçues:", JSON.stringify(data).substring(0, 500) + '...');

        if (data.error) { throw new Error(data.message || "Erreur renvoyée par l'API Google Apps Script."); }

        // Validation basique de la structure attendue
        if (!data || typeof data !== 'object' || typeof data.baseRates !== 'object' || typeof data.travcoBaseRates !== 'object' || !Array.isArray(data.tariffStructure) || !Array.isArray(data.partners)) {
            console.error("APP_DATA: Format de données invalide reçu:", data);
            throw new Error("Format des données (baseRates/travcoBaseRates/tariffStructure/partners) invalide.");
        }

        const processResult = processFetchedData(data); // Traite et stocke les données

        // Vérifie si les données essentielles sont présentes après traitement
         if (baseRatesByDate.size === 0 && travcoBaseRatesByDate.size === 0) {
             // Aucune donnée de base critique trouvée
             showAppMessage(messageAreaId, "Aucune donnée de tarifs de base trouvée dans la feuille Sheets. Calculs impossibles.", "error", 0);
             clearAppData(); // Assure que tout est vide
             sheetDataCache.data = null; sheetDataCache.timestamp = null; // Invalide cache
             return false; // Échec critique
         }
        if (allCategories.size === 0 || allPlans.size === 0) {
             // Avertissement si structure ou partenaires vides, mais pas bloquant si bases OK
              showAppMessage(messageAreaId, "Avertissement: Structure tarifs ou liste partenaires vide. Certaines options pourraient manquer.", "warning", 10000);
        }
        if (processResult.missingPlanWarningsCount > 0) {
             showAppMessage(messageAreaId, `Avertissement: ${processResult.missingPlanWarningsCount} plan(s) mentionné(s) chez les partenaires non trouvés dans la structure globale.`, 'warning', 10000);
        }


        sheetDataCache.data = data; // Met en cache
        sheetDataCache.timestamp = now;

        showAppMessage(messageAreaId, "Données de tarifs chargées avec succès.", "success", 5000);
        return true; // Succès

    } catch (error) {
        console.error("APP_DATA: Erreur détaillée fetch/process:", error);
        const loadingMessageElement = document.querySelector(`#${messageAreaId} .alert-info`);
        if (loadingMessageElement) { loadingMessageElement.remove(); }
        // Affiche message erreur persistant
        showAppMessage(messageAreaId, `Erreur critique chargement données: ${error.message}. Vérifie la configuration API et la console (F12).`, 'error', 0);
        clearAppData(); // Réinitialise tout en cas d'erreur critique
        sheetDataCache.data = null; sheetDataCache.timestamp = null; // Invalide cache
        return false; // Échec critique
    }
}


// --- Fonctions pour accéder aux données chargées ---

export function getBaseRates() {
    // Retourne une copie ou une vue pour éviter modifications externes non souhaitées
    return new Map(baseRatesByDate);
}

export function getTravcoBaseRates() {
     return new Map(travcoBaseRatesByDate);
}

export function getAllPartners() {
     return new Set(allPartners);
}

export function getAllCategories() {
     return new Set(allCategories);
}

export function getAllPlans() {
     return new Set(allPlans);
}

export function getPartnerToPlansMap() {
     // Retourne une Map de Sets
    const mapCopy = new Map();
    partnerToPlansMap.forEach((plans, partner) => {
        mapCopy.set(partner, new Set(plans));
    });
    return mapCopy;
}

export function getPlanToCategoriesMap() {
     // Retourne une Map de Sets
    const mapCopy = new Map();
    planToCategoriesMap.forEach((categories, plan) => {
        mapCopy.set(plan, new Set(categories));
    });
    return mapCopy;
}

export function getCategoryToPlansMap() {
     // Retourne une Map de Sets
    const mapCopy = new Map();
    categoryToPlansMap.forEach((plans, category) => {
        mapCopy.set(category, new Set(plans));
    });
    return mapCopy;
}

export function getOriginalPlanOrder() {
     // Retourne une copie de l'objet d'ordre
    return JSON.parse(JSON.stringify(originalPlanOrder));
}

// --- END OF FILE api.js ---