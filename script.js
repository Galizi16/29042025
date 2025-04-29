import { loadAppData, getAllPartners, getCategoryToPlansMap, getPartnerToPlansMap, getOriginalPlanOrder, ratePlanDescriptions, ABSOLUTE_BASE_CATEGORY_NAME, getAllPlans } from './api.js';
import { calculateDailyRate } from './calcul.js';
import { showAppMessage, showLoading, hideResult, formatDateLocale, generateStayDates, getElementValue, getElementValueAsInt, getElementValueAsFloat, populateDropdown } from './utils.js';


// --- Activation/Désactivation des formulaires ---
function disableFormsIndex() {
    console.log("INDEX: Désactivation des formulaires et de la section choix.");
    // On ne désactive que les formulaires présents dans index.html
    ['calculate', 'verify'].forEach(prefix => {
        const form = document.getElementById(`${prefix}-form`);
        if (form) {
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
        }
        hideResult(`${prefix}-result`);
    });
    const choiceSection = document.getElementById('choice-section');
    if (choiceSection) {
        choiceSection.style.opacity = '0.5'; // Grise la section choix
        choiceSection.style.pointerEvents = 'none'; // Empêche clics
    }
}

function enableFormsIndex() {
   console.log("INDEX: Activation des formulaires et peuplement initial...");
    // On n'active que les formulaires présents dans index.html
   ['calculate', 'verify'].forEach(prefix => {
       const form = document.getElementById(`${prefix}-form`);
       if (form) {
            console.log(`INDEX: Activation formulaire: ${prefix}-form`);
            // Active les champs de base et le partenaire
            form.querySelectorAll('input[type="date"], input[type="number"], button').forEach(el => el.disabled = false);
            updatePartnerOptions(prefix); // Peuple et active le select partenaire
            // Les selects dépendants (catégorie, plan) seront activés par la logique de cascade

            // Marque comme non initialisé pour les listeners
            form.dataset.listenersAttached = 'false';
       } else {
           console.warn(`INDEX: Formulaire introuvable pour le préfixe: ${prefix}`);
       }
   });
   // Réactive la section de choix
   const choiceSection = document.getElementById('choice-section');
   if (choiceSection) {
       choiceSection.style.opacity = '1';
       choiceSection.style.pointerEvents = 'auto';
       console.log("INDEX: Section de choix réactivée.");
   }
}


// --- Fonctions de Mise à Jour des Dropdowns (Spécifiques à Index) ---

function updatePartnerOptions(formPrefix) {
    // Pour calculate/verify, le partenaire peut être "Tous"
    populateDropdown(`${formPrefix}-partner`, getAllPartners(), 'Sélectionnez Partenaire...', true, "", "Tous les partenaires");
}

function updateCategoryOptions(formPrefix) {
    const partnerSelectId = `${formPrefix}-partner`;
    const categorySelectId = `${formPrefix}-room-category`;
    const planSelectId = `${formPrefix}-rate-plan`; // Toujours un seul plan pour Calcul/Vérif

    const selectedPartner = getElementValue(partnerSelectId);
    const selectedPlan = getElementValue(planSelectId);

    let availableCategories = new Set();
    let placeholder = "Sélectionnez Catégorie...";
    let optionsToPopulate = new Set();

    // Pour Calcul/Vérif: les catégories dépendent du PLAN choisi (et potentiellement partenaire)
    if (!selectedPlan) {
        placeholder = "Sélectionnez un Plan...";
        optionsToPopulate = new Set(); // Pas de plan = pas de catégorie
    } else {
        const planToCategories = getPlanToCategoriesMap(); // Accès aux données via API module
        const plansForPartner = getPartnerToPlansMap(); // Accès aux données via API module
        const categoriesForPlan = planToCategories.get(selectedPlan) || new Set();

        if (!selectedPartner) { // "Tous partenaires"
            optionsToPopulate = categoriesForPlan;
        } else { // Partenaire spécifique
            // On vérifie juste que le plan est bien lié au partenaire (normalement oui grâce à updateRatePlanOptions)
             if (plansForPartner.get(selectedPartner)?.has(selectedPlan)) {
                  optionsToPopulate = categoriesForPlan;
             } else {
                  // Cas d'incohérence (ne devrait pas arriver avec la logique en place)
                  console.warn(`INDEX: Incohérence: Plan '${selectedPlan}' sélectionné mais non associé au partenaire '${selectedPartner}'.`);
                  optionsToPopulate = new Set();
                  placeholder = "Incohérence Plan/Partenaire";
             }
        }
        if (optionsToPopulate.size === 0) {
            placeholder = `Aucune catégorie pour le plan ${selectedPlan}`;
        }
    }

    populateDropdown(categorySelectId, optionsToPopulate, placeholder);
    const categorySelect = document.getElementById(categorySelectId);
    if (categorySelect) {
        // Active/Désactive en fonction du contexte
        categorySelect.disabled = optionsToPopulate.size === 0;
    }
}

function updateRatePlanOptions(formPrefix) {
    // Valable pour Calculate et Verify
    const partnerSelectId = `${formPrefix}-partner`;
    const categorySelectId = `${formPrefix}-room-category`; // Peut être vide
    const ratePlanSelectId = `${formPrefix}-rate-plan`;

    const selectedPartner = getElementValue(partnerSelectId);
    const selectedCategory = getElementValue(categorySelectId); // Non utilisé pour le filtre plan->cat, mais pour l'ordre

    let availablePlans = new Set();
    let placeholder = "Sélectionnez Plan...";
    let orderSourceCategory = null; // Pour tri
    let optionsToPopulate = new Set();

    const allKnownPlans = getAllPlans(); // Accès aux données via API module <-- AJOUTÉ
    const plansForPartnerMap = getPartnerToPlansMap(); // Accès aux données via API module
    const plansForCategoryMap = getCategoryToPlansMap(); // Accès aux données via API module
    const originalPlanOrderMap = getOriginalPlanOrder(); // Accès aux données via API module

    if (!selectedCategory) {
        // Si pas de catégorie (parce que le plan n'a pas encore été choisi ou la catégorie n'a pas été sélectionnée après le plan)
        if (!selectedPartner) { // Tous partenaires
            optionsToPopulate = allKnownPlans;
            placeholder = "Sélectionnez Plan...";
            orderSourceCategory = ABSOLUTE_BASE_CATEGORY_NAME; // Tri basé sur ordre Dbl Classique comme fallback
        } else { // Partenaire spécifique
            optionsToPopulate = plansForPartnerMap.get(selectedPartner) || new Set();
            placeholder = "Sélectionnez Plan...";
             // Essaye de trier selon Dbl Classique si possible
            orderSourceCategory = ABSOLUTE_BASE_CATEGORY_NAME;
             if (optionsToPopulate.size === 0) {
                  placeholder = `Aucun plan pour ce partenaire (${selectedPartner})`;
             }
        }
    } else {
        // Si une catégorie est sélectionnée (cas où le plan a été choisi et la catégorie filtrée)
        const plansForSelectedCategory = plansForCategoryMap.get(selectedCategory) || new Set();
        orderSourceCategory = selectedCategory; // Tri basé sur l'ordre de cette catégorie spécifique

        if (!selectedPartner) { // Tous partenaires
             optionsToPopulate = plansForSelectedCategory;
        } else { // Partenaire spécifique ET catégorie sélectionnée
             const plansForSelectedPartner = plansForPartnerMap.get(selectedPartner) || new Set();
            // Intersection des plans pour la catégorie ET le partenaire
            optionsToPopulate = new Set([...plansForSelectedCategory].filter(plan => plansForSelectedPartner.has(plan)));
            if (optionsToPopulate.size === 0) {
                placeholder = `Aucun plan commun pour ${selectedPartner} & ${selectedCategory}`;
            }
        }
    }

    // Tri des plans selon l'ordre original de la catégorie source, puis alpha
    let orderedPlans = [];
    if (orderSourceCategory && originalPlanOrderMap[orderSourceCategory]) {
        // Prend les plans de l'ordre original qui sont dans les options disponibles
        orderedPlans = originalPlanOrderMap[orderSourceCategory].filter(plan => optionsToPopulate.has(plan));
        // Ajoute les plans disponibles qui n'étaient pas dans l'ordre original (triés alpha)
        const remainingPlans = [...optionsToPopulate].filter(plan => !orderedPlans.includes(plan));
        remainingPlans.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        orderedPlans = [...orderedPlans, ...remainingPlans];
         console.log(`INDEX: Tri plans pour ${ratePlanSelectId} basé sur ordre catégorie '${orderSourceCategory}'.`);
    } else {
        // Fallback: tri alphabétique simple si aucune catégorie sélectionnée ou pas d'ordre défini
        orderedPlans = [...optionsToPopulate].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
         console.log(`INDEX: Tri plans pour ${ratePlanSelectId} en mode fallback (alphabétique).`);
    }


    populateDropdown(ratePlanSelectId, new Set(orderedPlans), placeholder); // Utilise populateDropdown avec l'array ordonné
    const ratePlanSelect = document.getElementById(ratePlanSelectId);
    if (ratePlanSelect) {
        ratePlanSelect.disabled = orderedPlans.length === 0; // Désactive si pas d'options
        updateRatePlanHelpIndex(ratePlanSelect.value, `${formPrefix}-rate-plan-help`);
    }

    // Mise à jour de la catégorie si un partenaire est sélectionné mais aucun plan
    const categorySelect = document.getElementById(`${formPrefix}-room-category`);
    if (categorySelect && selectedPartner && !getElementValue(ratePlanSelectId)) {
        // Réinitialise et désactive la catégorie car elle dépend du plan
        populateDropdown(`${formPrefix}-room-category`, new Set(), "Sélectionnez Plan..."); // Use populateDropdown utilitaire
        categorySelect.value = "";
        categorySelect.disabled = true;
    }
}

function updateRatePlanHelpIndex(planCode, helpTextId) {
    const helpTextElement = document.getElementById(helpTextId);
    if (helpTextElement) {
        const description = ratePlanDescriptions[planCode]; // Utilise données API
        helpTextElement.textContent = description || (planCode ? '' : ''); // Affiche description ou rien
    }
}


// --- Fonctions de Calcul Global (calculateDetailedCost pour Index) ---

async function calculateDetailedCost(formData) {
    const resultDivId = `${formData.formPrefix}-result`;
    showLoading(resultDivId, "Calcul en cours..."); // Utilise utilitaire

    let stayDates;
    try {
        stayDates = generateStayDates(formData.arrivalDate, formData.nights); // Utilise utilitaire
    } catch (e) {
        showAppMessage('global-message-area', `Erreur dates: ${e.message}`, 'error'); // Utilise utilitaire
        hideResult(resultDivId); // Utilise utilitaire
        return null;
    }

    let subtotal = 0;
    const dailyRatesDetails = [];
    let missingRateWarning = false;
    let firstMissingDate = null;

    for (const date of stayDates) {
        const dailyRate = calculateDailyRate(date, formData.roomCategory, formData.ratePlan); // Utilise logique de calcul

        if (dailyRate === null) {
            // Si calculateDailyRate retourne null, c'est qu'un tarif base (OTA ou Travco) manque
            missingRateWarning = true;
            if (!firstMissingDate) firstMissingDate = formatDateLocale(date); // Utilise utilitaire
            // On ne peut pas récupérer la base exacte si calculateDailyRate a retourné null car la base manquait
            dailyRatesDetails.push({
                date: formatDateLocale(date), // Utilise utilitaire
                baseRateSource: formData.ratePlan.startsWith('TRAVCO-') ? 'Travco' : 'OTA', // Indique quelle base manquait
                baseRateValue: null,
                finalRate: 0 // Compte comme 0 pour le total
            });
        } else {
            subtotal += dailyRate;
            // Pour l'affichage, on récupère aussi la valeur du tarif base utilisé
             // Note: Cette logique est encore ici pour l'affichage détaillé.
             // Elle pourrait être déplacée dans calculateDailyRate si nécessaire
             // d'y avoir accès, mais pour juste l'affichage ici, ça va.
             const baseRates = getBaseRates(); // Utilise données API
             const travcoRates = getTravcoBaseRates(); // Utilise données API

             const baseRateValue = formData.ratePlan.startsWith('TRAVCO-')
                 ? travcoRates.get(formatDateYYYYMMDD(date)) // Utilise utilitaire
                 : baseRates.get(formatDateYYYYMMDD(date)); // Utilise utilitaire

             dailyRatesDetails.push({
                 date: formatDateLocale(date), // Utilise utilitaire
                 baseRateSource: formData.ratePlan.startsWith('TRAVCO-') ? 'Travco' : 'OTA',
                 baseRateValue: baseRateValue, // Peut être null même si dailyRate n'est pas null (si formule fixe genre Travco)
                 finalRate: dailyRate
             });
        }
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const discountPercentage = parseFloat(formData.discount) || 0;
    const discountAmount = Math.round((subtotal * (discountPercentage / 100)) * 100) / 100;
    const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;

    if (missingRateWarning) {
        showAppMessage('global-message-area', `Attention: Tarif base manquant pour certaines dates (à partir du ${firstMissingDate}). Nuits calculées à 0€.`, "warning", 10000); // Utilise utilitaire
    }

    // Avertissement si total 0 sans erreur apparente de date manquante
    if (finalTotal === 0 && subtotal === 0 && !missingRateWarning && formData.nights > 0) {
        showAppMessage('global-message-area', "Avertissement: Le total résultant est 0€. Vérifiez les tarifs de base ou les formules pour ces dates.", "warning"); // Utilise utilitaire
    }

    return {
        dailyRates: dailyRatesDetails,
        subtotal: subtotal,
        discountAmount: discountAmount,
        total: finalTotal,
        missingRateWarning: missingRateWarning
    };
}


// --- Fonctions d'Affichage des Résultats (Spécifiques à Index) ---

function displayCalculateResult(formData, result) {
    const resultDiv = document.getElementById('calculate-result');
    if (!resultDiv) { console.error("INDEX: Element 'calculate-result' introuvable."); return; }
    if (!result) { resultDiv.innerHTML = `<div class='text-red-400 p-4'>Calcul détaillé échoué.</div>`; resultDiv.classList.remove('hidden'); return; }

    let arrivalDate, departureDate;
    try {
         arrivalDate = new Date(formData.arrivalDate + 'T00:00:00Z');
         departureDate = new Date(arrivalDate);
         departureDate.setUTCDate(arrivalDate.getUTCDate() + formData.nights);
         if (isNaN(arrivalDate.getTime()) || isNaN(departureDate.getTime())) throw new Error();
    } catch (e) { showAppMessage('global-message-area', "Erreur interne: Impossible de formater les dates.", "error"); return; } // Utilise utilitaire

    const planDescription = ratePlanDescriptions[formData.ratePlan] || `(Description non disponible)`; // Utilise données API
    const partnerText = formData.partner && formData.partner !== "" ? `Partenaire: ${formData.partner}` : 'Partenaire: Tous';


    const tableRows = result.dailyRates.map(rate => {
        let baseRateText = '<span class="italic text-xs text-gray-500">Manquant</span>';
        // Use constants from api.js
        let baseRateTitle = `Tarif base ${rate.baseRateSource} manquant`;
        if (rate.baseRateValue !== null) {
            baseRateText = `${rate.baseRateValue.toFixed(2)}€`;
             baseRateTitle = `Tarif Base ${rate.baseRateSource} (Source: ${rate.baseRateSource === 'OTA' ? BASE_RATE_PLAN_NAME : TRAVCO_BASE_PLAN} / ${rate.baseRateSource === 'OTA' ? ABSOLUTE_BASE_CATEGORY_NAME : TRAVCO_BASE_CATEGORY})`;
        }
        const finalRateText = rate.finalRate !== null ? `${rate.finalRate.toFixed(2)}€` : '<span class="italic text-xs text-red-400">Erreur Calcul</span>';

        return `<tr>
                    <td class="px-3 py-2 text-sm text-gray-300">${rate.date}</td>
                    <td class="px-3 py-2 text-end text-sm text-gray-400" title="${baseRateTitle}">${baseRateText}</td>
                    <td class="px-3 py-2 text-end text-sm font-medium text-gray-100">${finalRateText}</td>
                </tr>`;
    }).join('');

    const resultHtml = `
        <h5 class="text-xl font-semibold mb-4 text-light-orange highlight-orange">Détail du calcul pour ${formData.nights} nuit(s)</h5>
        <div class="text-sm text-gray-300 mb-4 space-y-1">
            <p><i class="fas fa-calendar-alt fa-fw mr-2 text-gray-400"></i>Du ${formatDateLocale(arrivalDate)} au ${formatDateLocale(departureDate)}</p>
            <p><i class="fas fa-users fa-fw mr-2 text-gray-400"></i>${partnerText}</p>
            <p><i class="fas fa-bed fa-fw mr-2 text-gray-400"></i>Chambre: <strong>${formData.roomCategory}</strong></p>
            <p><i class="fas fa-tag fa-fw mr-2 text-gray-400"></i>Plan: <strong>${formData.ratePlan}</strong> <span class="text-xs italic text-gray-400 ml-1">${planDescription}</span></p>
        </div>
        ${result.missingRateWarning ? `<p class="alert alert-warning text-xs"><i class="fas fa-exclamation-triangle"></i> Certains tarifs de base journaliers manquaient (nuit calculée à 0€).</p>` : ''}
        <div class="overflow-x-auto rounded-md border border-gray-700 mb-5 shadow-md">
            <table class="min-w-full divide-y divide-gray-700 table">
                <caption class="caption-top text-xs text-gray-400 p-1 bg-darker-charcoal rounded-t-md">Détail par nuit</caption>
                <thead class="bg-darker-charcoal">
                    <tr>
                        <th class="th-style text-left">Date</th>
                        <th class="th-style text-end">Tarif Base Absolu<br><span class="text-xs normal-case">(Source: ${result.dailyRates[0]?.baseRateSource || 'N/A'})</span></th>
                        <th class="th-style text-end">Tarif Calculé<br><span class="text-xs normal-case">Journalier</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700 bg-charcoal-dark/40">${tableRows}</tbody>
            </table>
        </div>
        <hr class="border-gray-600 my-4">
        <div class="flex justify-end text-sm">
            <div class="text-right text-gray-300 mr-4 space-y-1">
                <p>Sous-total :</p>
                ${formData.discount > 0 ? `<p>Remise (${formData.discount}%) :</p>` : ''}
                <p class="text-base font-semibold text-gray-100 mt-1">Total Calculé :</p>
            </div>
            <div class="text-right space-y-1">
                <p class="text-gray-200 font-mono">${result.subtotal.toFixed(2)}€</p>
                ${formData.discount > 0 ? `<p class="text-red-400 font-mono">-${result.discountAmount.toFixed(2)}€</p>` : ''}
                <p class="text-lg font-bold text-vibrant-orange mt-1 font-mono"><strong>${result.total.toFixed(2)}€</strong></p>
            </div>
        </div>`;
    resultDiv.innerHTML = resultHtml;
    resultDiv.classList.remove('hidden');
}

function displayVerifyResult(formData, calculatedResult) {
    const resultDiv = document.getElementById('verify-result');
    if (!resultDiv) { console.error("INDEX: Element 'verify-result' introuvable."); return; }
    if (!calculatedResult) { resultDiv.innerHTML = `<div class='text-red-400 p-4'>Calcul pour vérification échoué.</div>`; resultDiv.classList.remove('hidden'); return; }

    let arrivalDate, departureDate;
    try { arrivalDate = new Date(formData.arrivalDate + 'T00:00:00Z'); departureDate = new Date(arrivalDate); departureDate.setUTCDate(arrivalDate.getUTCDate() + formData.nights); if (isNaN(arrivalDate.getTime()) || isNaN(departureDate.getTime())) throw new Error(); }
    catch (e) { showAppMessage('global-message-area', "Erreur interne: Impossible de formater les dates.", "error"); return; } // Utilise utilitaire

    const receivedTotalNum = getElementValueAsFloat('received-total'); // Utilise utilitaire
    let difference = NaN; let isEqual = false;
    if (receivedTotalNum !== null && !isNaN(receivedTotalNum)) {
        difference = Math.abs(calculatedResult.total - receivedTotalNum);
        isEqual = difference < 0.01; // Tolérance pour erreurs virgule flottante
    }

    const planDescription = ratePlanDescriptions[formData.ratePlan] || `(Description N/A)`; // Utilise données API
    const partnerText = formData.partner && formData.partner !== "" ? `Partenaire: ${formData.partner}` : 'Partenaire: Tous';

    let alertClass = 'alert-error'; let alertIcon = 'fa-exclamation-triangle'; let alertTitle = 'ERREUR'; let alertMessage = 'Total reçu invalide.';
    if (receivedTotalNum !== null && !isNaN(receivedTotalNum)) {
         alertClass = isEqual ? 'alert-success' : 'alert-warning'; // Warning pour écart, success si OK
         alertIcon = isEqual ? 'fa-check-circle' : 'fa-exclamation-triangle';
         alertTitle = isEqual ? 'CONCORDANCE OK' : 'ÉCART DÉTECTÉ';
         alertMessage = isEqual ? '' : `<span class="text-sm">(Différence : ${difference.toFixed(2)}€)</span>`;
    }

    const alertHtml = `<div class="alert ${alertClass} text-base mb-4 shadow-lg"><i class="fas ${alertIcon} text-xl"></i><div class="ml-3"><span class="font-semibold block">${alertTitle}</span>${alertMessage}</div></div>`;

    const tableRows = calculatedResult.dailyRates.map(rate => {
        let baseRateText = '<span class="italic text-xs text-gray-500">Manquant</span>';
        // Use constants from api.js
        let baseRateTitle = `Tarif base ${rate.baseRateSource} manquant`;
        if (rate.baseRateValue !== null) {
            baseRateText = `${rate.baseRateValue.toFixed(2)}€`;
             baseRateTitle = `Tarif Base ${rate.baseRateSource} (Source: ${rate.baseRateSource === 'OTA' ? BASE_RATE_PLAN_NAME : TRAVCO_BASE_PLAN} / ${rate.baseRateSource === 'OTA' ? ABSOLUTE_BASE_CATEGORY_NAME : TRAVCO_BASE_CATEGORY})`;
        }
         const finalRateText = rate.finalRate !== null ? `${rate.finalRate.toFixed(2)}€` : '<span class="italic text-xs text-red-400">Erreur</span>';
        return `<tr>
                    <td class="px-3 py-2 text-sm text-gray-300">${rate.date}</td>
                    <td class="px-3 py-2 text-end text-sm text-gray-400" title="${baseRateTitle}">${baseRateText}</td>
                    <td class="px-3 py-2 text-end text-sm font-medium text-gray-100">${finalRateText}</td>
                </tr>`;
    }).join('');

    const resultHtml = `
        <h5 class="text-xl font-semibold mb-3 text-light-orange highlight-orange">Résultat de la Vérification</h5>
        ${alertHtml}
        <div class="text-sm text-gray-300 mb-4 space-y-1">
            <p><i class="fas fa-calendar-alt fa-fw mr-2 text-gray-400"></i>Du ${formatDateLocale(arrivalDate)} au ${formatDateLocale(departureDate)} (${formData.nights} nuit(s))</p>
            <p><i class="fas fa-users fa-fw mr-2 text-gray-400"></i>${partnerText}</p>
            <p><i class="fas fa-bed fa-fw mr-2 text-gray-400"></i>Chambre: <strong>${formData.roomCategory}</strong></p>
            <p><i class="fas fa-tag fa-fw mr-2 text-gray-400"></i>Plan: <strong>${formData.ratePlan}</strong> <span class="text-xs italic text-gray-400 ml-1">${planDescription}</span> | Remise: ${formData.discount}%</p>
        </div>
        ${calculatedResult.missingRateWarning ? `<p class="alert alert-warning text-xs"><i class="fas fa-exclamation-triangle"></i> Certains tarifs de base manquaient (calcul système à 0€ pour ces nuits).</p>` : ''}
        <div class="overflow-x-auto rounded-md border border-gray-700 mb-5 shadow-md">
             <table class="min-w-full divide-y divide-gray-700 table">
                <caption class="caption-top text-xs text-gray-400 p-1 bg-darker-charcoal rounded-t-md">Détail du calcul système</caption>
                <thead class="bg-darker-charcoal">
                    <tr>
                        <th class="th-style text-left">Date</th>
                         <th class="th-style text-end">Tarif Base Absolu<br><span class="text-xs normal-case">(Source: ${calculatedResult.dailyRates[0]?.baseRateSource || 'N/A'})</span></th>
                        <th class="th-style text-end">Tarif Calculé<br><span class="text-xs normal-case">Journalier</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700 bg-charcoal-dark/40">${tableRows}</tbody>
            </table>
        </div>
        <hr class="border-gray-600 my-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div class="bg-darker-charcoal/30 p-3 rounded border border-gray-700/50">
                <p class="font-medium text-gray-200 mb-2">Récapitulatif Calcul Système :</p>
                <div class="space-y-1 text-gray-300">
                    <p>Sous-total: <span class="float-right font-mono">${calculatedResult.subtotal.toFixed(2)}€</span></p>
                    ${formData.discount > 0 ? `<p>Remise (${formData.discount}%): <span class="float-right font-mono text-red-400">-${calculatedResult.discountAmount.toFixed(2)}€</span></p>` : ''}
                    <p class="font-semibold text-gray-100 pt-1 border-t border-gray-600/50 mt-1">Total Calculé: <strong class="text-lg float-right font-mono">${calculatedResult.total.toFixed(2)}€</strong></p>
                </div>
            </div>
            <div class="bg-darker-charcoal/30 p-3 rounded border border-gray-700/50">
                <p class="font-medium text-gray-200 mb-2">Comparaison :</p>
                <div class="space-y-1 text-gray-300">
                    <p class="font-semibold text-gray-100">Total Reçu Indiqué: <strong class="text-lg float-right font-mono">${receivedTotalNum !== null ? receivedTotalNum.toFixed(2) + '€' : 'N/A'}</strong></p>
                </div>
            </div>
        </div>`;
    resultDiv.innerHTML = resultHtml;
    resultDiv.classList.remove('hidden');
}


// --- Validation de Formulaire (Spécifique à Index) ---
function validateFormIndex(formData, mode) {
    const errors = [];
    // Champs communs
    if (!formData.arrivalDate) { errors.push("Date d'arrivée requise."); }
    else { try { const d = new Date(formData.arrivalDate + 'T00:00:00Z'); if (isNaN(d.getTime())) errors.push("Date d'arrivée invalide."); } catch (e) { errors.push("Format date arrivée incorrect."); } }
    if (!formData.nights || isNaN(formData.nights) || formData.nights < 1 || formData.nights > 90) { errors.push('Nombre de nuits valide (1-90) requis.'); }
    if (!formData.roomCategory) { errors.push('Catégorie de chambre requise.'); }

    // Champs spécifiques
    if (mode === 'calculate' || mode === 'verify') {
        if (!formData.ratePlan) { errors.push('Plan tarifaire requis.'); }
        const discount = formData.discount; // Déjà parsé en float ou 0
        if (discount === null || isNaN(discount) || discount < 0 || discount > 100) { errors.push('Remise invalide (nombre 0-100 requis).'); }
    }
    if (mode === 'verify') {
        const receivedTotal = getElementValueAsFloat('received-total'); // Utilise utilitaire
        if (receivedTotal === null || isNaN(receivedTotal) || receivedTotal < 0) { errors.push('Total reçu valide (nombre >= 0) requis.'); }
    }
    return { isValid: errors.length === 0, errors: errors };
}

// --- Initialisation et Écouteurs d'Événements ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("INDEX: DOM Chargé. Initialisation de l'application principale...");
    const choiceSection = document.getElementById('choice-section');
    const calculateSection = document.getElementById('calculate-section');
    const verifySection = document.getElementById('verify-section');
    const sections = [calculateSection, verifySection]; // Update sections array

    if (!choiceSection || sections.some(s => !s)) {
        console.error("INDEX: ERREUR FATALE: Elements HTML principaux manquants !");
        showAppMessage('global-message-area', "Erreur critique: Interface non initialisable. Vérifiez la console (F12).", "error", 0);
        return;
    }

    // --- Mise à jour date par défaut ---
    try {
        const today = new Date(); const yyyy = today.getFullYear(); const mm = String(today.getMonth() + 1).padStart(2, '0'); const dd = String(today.getDate()).padStart(2, '0'); const todayStr = `${yyyy}-${mm}-${dd}`;
        // Update IDs
        ['calculate-arrival-date', 'verify-arrival-date'].forEach(id => {
            const input = document.getElementById(id); if (input) input.value = todayStr;
        });
    } catch (e) { console.error("INDEX: Erreur mise à jour date défaut:", e); }

    // --- Désactive tout au départ ---
    disableFormsIndex();

    // --- Chargement des données initiales via API module ---
    const dataLoaded = await loadAppData('global-message-area');

    if (dataLoaded) {
        console.log("INDEX: Données chargées et traitées. Activation interface.");
        enableFormsIndex(); // Active les formulaires et la section choix
        // Attache les listeners une seule fois après l'activation initiale
        setupFormListeners('calculate');
        setupFormListeners('verify');
        setupChoiceListenersIndex(); // Attache listeners pour les cartes de choix (sauf le lien)
        setupBackButtonsIndex(); // Attache listeners pour les boutons retour
    } else {
         console.log("INDEX: Échec du chargement initial des données. Interface désactivée.");
         // Le message d'erreur persistant est déjà affiché par loadAppData
         // Les formulaires restent désactivés par disableFormsIndex
    }
}); // Fin DOMContentLoaded


// --- Setup des Listeners (spécifique à Index) ---

function setupChoiceListenersIndex() {
     const choiceSection = document.getElementById('choice-section');
     const calculateSection = document.getElementById('calculate-section');
     const verifySection = document.getElementById('verify-section');
     const sections = [calculateSection, verifySection]; // Update sections array

     document.querySelectorAll('.choice-card').forEach(card => {
        // MODIFIED: Only attach listener to DIV cards that navigate within the page
        if (card.tagName === 'DIV' && card.getAttribute('data-target')) {
             card.addEventListener('click', () => {
                const targetSectionId = card.getAttribute('data-target');
                const targetSection = document.getElementById(targetSectionId);

                if (targetSection && choiceSection) {
                    console.log(`INDEX: Affichage section: ${targetSectionId}`);
                    choiceSection.classList.add('hidden'); // Masque choix
                    sections.forEach(section => section.classList.add('hidden')); // Masque toutes les sections
                    targetSection.classList.remove('hidden'); // Affiche la cible
                    // Hide results specific to index.html
                    hideResult('calculate-result'); hideResult('verify-result');
                } else {
                    console.error(`INDEX: Cible interne invalide ou non trouvée pour la carte cliquée: ${targetSectionId}`);
                    showAppMessage('global-message-area', "Erreur: Impossible d'afficher la section demandée.", "error"); // Utilise utilitaire
                }
             });
        }
        // NOTE: Les cartes <a href="suivi_tarifs.html"> sont gérées directement par le navigateur.
    });
}

function setupBackButtonsIndex() {
     const choiceSection = document.getElementById('choice-section');
     const calculateSection = document.getElementById('calculate-section');
     const verifySection = document.getElementById('verify-section');
     const sections = [calculateSection, verifySection]; // Update sections array

     document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log("INDEX: Clic sur bouton Retour");
            if (choiceSection) choiceSection.classList.remove('hidden'); // Affiche choix
            sections.forEach(section => section.classList.add('hidden')); // Masque toutes les sections formulaire
            // Hide results specific to index.html
            hideResult('calculate-result'); hideResult('verify-result');
        });
    });
}

function setupFormListeners(formPrefix) {
    // Only set up listeners for calculate and verify
    if (formPrefix !== 'calculate' && formPrefix !== 'verify') {
        console.warn(`INDEX: setupFormListeners appelé avec un préfixe non géré par ce script: ${formPrefix}`);
        return;
    }
    console.log(`INDEX: Attachement listeners pour préfixe: ${formPrefix}`);
    const formElement = document.getElementById(`${formPrefix}-form`);

    // Évite double attachement (sécurité)
    if (!formElement || formElement.dataset.listenersAttached === 'true') {
        console.warn(`INDEX: Listeners déjà attachés ou formulaire non trouvé pour ${formPrefix}. Skipping.`);
        return;
    }

    const partnerSelect = document.getElementById(`${formPrefix}-partner`);
    const categorySelect = document.getElementById(`${formPrefix}-room-category`);
    const ratePlanSelect = document.getElementById(`${formPrefix}-rate-plan`); // Single rate plan select


    // --- Listener Partenaire ---
    partnerSelect?.addEventListener('change', () => {
        console.log(`INDEX: Listener ${formPrefix}-partner changé`);
        // Met à jour les plans possibles (dépend du partenaire, AVANT la catégorie)
        updateRatePlanOptions(formPrefix);
        if (ratePlanSelect) ratePlanSelect.value = ""; // Réinitialise plan
        updateRatePlanHelpIndex(ratePlanSelect.value, `${formPrefix}-rate-plan-help`); // Use index specific help update
        // Désactive la catégorie tant qu'aucun plan n'est choisi
        if (categorySelect) {
             populateDropdown(`${formPrefix}-room-category`, new Set(), "Sélectionnez Plan..."); // Use populateDropdown utilitaire
             categorySelect.value = "";
             categorySelect.disabled = true;
        }
    });

    // --- Listener Catégorie ---
    // Pour Calculate/Verify, la catégorie est choisie APRES le plan.
    categorySelect?.addEventListener('change', () => {
        console.log(`INDEX: Listener ${formPrefix}-room-category changé`);
        // La sélection d'une catégorie ne change pas les options de plan (qui dépendent du partenaire+plan déjà choisi)
        // Elle ne fait rien d'autre ici dans la cascade Calculate/Verify.
    });

    // --- Listener Plan Tarifaire (pour Calcul/Vérif) ---
    ratePlanSelect?.addEventListener('change', (e) => {
        console.log(`INDEX: Listener ${formPrefix}-rate-plan changé pour ${e.target.value}`);
        // La sélection d'un plan débloque/met à jour les catégories possibles pour ce plan
        updateCategoryOptions(formPrefix);
        if (categorySelect) categorySelect.value = ""; // Réinitialise catégorie à chaque changement de plan
        // Met à jour l'aide du plan
        updateRatePlanHelpIndex(e.target.value, `${formPrefix}-rate-plan-help`); // Use index specific help update
    });


     // --- Listener Soumission Formulaire ---
     formElement.addEventListener('submit', async (e) => {
         e.preventDefault(); // Empêche rechargement page
         console.log(`INDEX: Formulaire ${formPrefix} soumis.`);
         const resultDivId = `${formPrefix}-result`;
         hideResult(resultDivId); // Utilise utilitaire
         showLoading(resultDivId, "Traitement..."); // Utilise utilitaire

         // Récupération des données du formulaire
         let formData = { formPrefix: formPrefix };
         try {
             formData.arrivalDate = getElementValue(`${formPrefix}-arrival-date`); // Utilise utilitaire
             formData.nights = getElementValueAsInt(`${formPrefix}-nights`); // Utilise utilitaire
             formData.partner = getElementValue(`${formPrefix}-partner`); // Utilise utilitaire // Peut être "" pour "Tous"
             formData.roomCategory = getElementValue(`${formPrefix}-room-category`); // Utilise utilitaire

             // These fields are specific to calculate/verify modes now
             formData.ratePlan = getElementValue(`${formPrefix}-rate-plan`); // Utilise utilitaire
             formData.discount = getElementValueAsFloat(`${formPrefix}-discount`) ?? 0; // Utilise utilitaire // Défaut 0 si invalide
             if (formPrefix === 'verify') {
                 formData.receivedTotal = getElementValue('received-total'); // Utilise utilitaire // Garde en string pour validation
             }

             // Validation
             console.log(`INDEX: Validation formulaire ${formPrefix} avec données:`, JSON.parse(JSON.stringify(formData)));
             const validation = validateFormIndex(formData, formPrefix); // Use index specific validation
             if (!validation.isValid) {
                 showAppMessage('global-message-area', `Erreurs Formulaire ${formPrefix.charAt(0).toUpperCase() + formPrefix.slice(1)}:\n- ${validation.errors.join('\n- ')}`, 'warning'); // Utilise utilitaire
                 hideResult(resultDivId); // Utilise utilitaire // Cache le loading
                 return; // Arrête le traitement
             }

             // Exécution de l'action (calcul ou vérif)
             console.log(`INDEX: Soumission formulaire ${formPrefix} validée. Exécution action...`);
             let resultData = null;
             if (formPrefix === 'calculate') {
                 resultData = await calculateDetailedCost(formData); // Utilise la fonction de ce script
                 if (resultData) displayCalculateResult(formData, resultData); // Utilise la fonction de ce script
             } else if (formPrefix === 'verify') {
                 resultData = await calculateDetailedCost(formData); // Utilise la fonction de ce script // On recalcule pour comparer
                 if (resultData) displayVerifyResult(formData, resultData); // Utilise la fonction de ce script
             }

             // Si le calcul a échoué (resultData est null) et qu'aucun résultat n'est affiché
             if (!resultData && document.querySelector(`#${resultDivId} .loading-indicator`)) {
                  hideResult(resultDivId); // Utilise utilitaire // Cache le loading si l'action a échoué silencieusement
                  showAppMessage('global-message-area', "Une erreur s'est produite pendant le calcul.", "error"); // Utilise utilitaire
             }

         } catch (error) {
             console.error(`INDEX: Erreur lors de la soumission du formulaire ${formPrefix}:`, error);
             showAppMessage('global-message-area', `Erreur inattendue (${formPrefix}): ${error.message}`, 'error'); // Utilise utilitaire
             hideResult(resultDivId); // Utilise utilitaire // Cache le loading en cas d'erreur JS
         }
     });

     formElement.dataset.listenersAttached = 'true'; // Marque comme initialisé
     console.log(`INDEX: Listeners attachés pour ${formPrefix}.`);
} // Fin setupFormListeners