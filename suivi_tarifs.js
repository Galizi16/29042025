// --- START OF FILE suivi_tarifs.js ---
import { loadAppData, getAllPartners, getAllCategories, getCategoryToPlansMap, getPartnerToPlansMap, getOriginalPlanOrder, ratePlanDescriptions, getAllPlans } from './api.js';
import { calculateDailyRate } from './calcul.js';
import { showAppMessage, showLoading, hideResult, formatDateYYYYMMDD, formatDateLocale, generateStayDates, getElementValue, getElementValueAsInt, populateDropdown } from './utils.js';

// --- État de l'interface dynamique (Spécifique à Suivi) ---
let comparisonBlockCounter = 0; // Compteur pour les blocs partenaire/plan
let tarifsChart = null; // Instance de Chart.js


// ==========================================================================
// ==               LOGIQUE INTERFACE DYNAMIQUE & CHART.JS               ==
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("SUIVI: DOM Chargé. Initialisation de l'application de comparaison...");
    // Initialise les dropdowns et attache les listeners après chargement des données
    await initializeSuiviApp();
});

async function initializeSuiviApp() {
    disableSuiviForm(); // Désactive le formulaire pendant le chargement des données

    // --- Chargement des données initiales via API module ---
    // Utilise la zone de message spécifique à la page suivi_tarifs.html
    const dataLoaded = await loadAppData('suivi-global-message-area');

    if (dataLoaded) {
        console.log("SUIVI: Données chargées et traitées. Activation interface.");
        initializeSuiviForm(); // Peuple les dropdowns et set les dates par défaut
        setupSuiviEventListeners(); // Attache les listeners du formulaire
        initializeChart(); // Initialise Chart.js (sans données au début)

        enableSuiviForm(); // Active le formulaire
    } else {
        console.error("SUIVI: Échec de l'initialisation de l'application de comparaison.");
         // Le message d'erreur persistant est déjà affiché par loadAppData
         // Le formulaire reste désactivé par disableSuiviForm
    }
}

function initializeSuiviForm() {
     console.log("SUIVI: Initialisation du formulaire de comparaison...");
    // Set dates par défaut
    try {
        const today = new Date();
        const oneWeekLater = new Date();
        oneWeekLater.setUTCDate(today.getUTCDate() + 7);

        const todayStr = formatDateYYYYMMDD(today); // Utilise utilitaire
        const oneWeekLaterStr = formatDateYYYYMMDD(oneWeekLater); // Utilise utilitaire

        const dateDebutInput = document.getElementById('suivi-dateDebut');
        const dateFinInput = document.getElementById('suivi-dateFin');

        if (dateDebutInput) dateDebutInput.value = todayStr;
        if (dateFinInput) dateFinInput.value = oneWeekLaterStr;

    } catch (e) { console.error("SUIVI: Erreur mise à jour date défaut:", e); }

    // Peuple la catégorie de chambre
    updateRoomCategoryOptionsSuivi();

    // Ajoute les blocs de comparaison initiaux
    // On ajoute 2 blocs par défaut car la comparaison nécessite au moins 2 plans
    addPartnerComparisonBlock();
    addPartnerComparisonBlock();

     // Cache le bouton Ajouter si 2 blocs sont ajoutés initialement et que la limite est atteinte (ici 4)
     if (comparisonBlockCounter >= 4) { // Assurez-vous que cette limite correspond à celle dans le listener
          document.getElementById('suivi-addPartnerBtn').classList.add('hidden');
     } else {
         document.getElementById('suivi-addPartnerBtn').classList.remove('hidden'); // Assure qu'il est visible si < 4
     }

}


function setupSuiviEventListeners() {
    console.log("SUIVI: Attachement des listeners du formulaire de comparaison...");

     // Listener sur le formulaire principal (soumission)
    document.getElementById('suiviForm')?.addEventListener('submit', handleSuiviFormSubmit);

    // Listener sur le bouton "Ajouter un Plan"
    document.getElementById('suivi-addPartnerBtn')?.addEventListener('click', () => {
         if (comparisonBlockCounter < 4) { // Limite à 4 comparaisons par exemple
             addPartnerComparisonBlock();
             if (comparisonBlockCounter >= 4) {
                 document.getElementById('suivi-addPartnerBtn').classList.add('hidden');
             }
         }
     });

     // Listener sur le sélecteur de Catégorie (met à jour les plans dans tous les blocs)
     document.getElementById('suivi-room-category')?.addEventListener('change', () => {
         console.log("SUIVI: Catégorie changée, mise à jour des plans dans tous les blocs...");
         updateAllComparisonPlanOptions();
         // Réinitialise les plans sélectionnés dans les blocs existants
          document.querySelectorAll('.plan-select-suivi').forEach(select => {
               select.value = "";
               const helpTextElement = select.closest('.partner-comparison-block').querySelector('.rate-plan-help-suivi');
               updateRatePlanHelpSuivi(select.value, helpTextElement); // Met à jour l'aide
               select.disabled = !select.querySelector('option[value=""]')?.selected; // Désactive si pas d'options valides au-delà du placeholder
          });
     });

      // Listener sur le bouton "Actualiser"
     document.getElementById('refreshBtn')?.addEventListener('click', resetSuiviForm);


}


function addPartnerComparisonBlock() {
     comparisonBlockCounter++;
     const container = document.getElementById('partnerComparisonsContainer');
     if (!container) { console.error("SUIVI: Conteneur des blocs de comparaison introuvable."); return; }

     const blockId = `suivi-comparison-block-${comparisonBlockCounter}`;
     const partnerSelectId = `suivi-partner-${comparisonBlockCounter}`;
     const planSelectId = `suivi-plan-${comparisonBlockCounter}`;
     const helpTextId = `suivi-plan-help-${comparisonBlockCounter}`;

     const partnerBlockDiv = document.createElement('div');
     partnerBlockDiv.id = blockId;
     partnerBlockDiv.className = 'partner-comparison-block space-y-3 fade-in'; // Ajout animation

     partnerBlockDiv.innerHTML = `
         <div class="flex justify-between items-center mb-2">
             <h5 class="font-medium text-gray-300">Plan de Comparaison ${comparisonBlockCounter}</h5>
             ${comparisonBlockCounter > 2 ? `<button type="button" class="remove-btn text-red-400 hover:text-red-300" data-block-id="${blockId}" aria-label="Supprimer"><i class="fas fa-times"></i></button>` : ''}
         </div>
         <div>
             <label for="${partnerSelectId}" class="label-style">Partenaire</label>
             <select id="${partnerSelectId}" class="partner-select-suivi input-style w-full" required>
                 <option value="">Chargement...</option>
             </select>
         </div>
         <div>
             <label for="${planSelectId}" class="label-style">Plan Tarifaire</label>
             <select id="${planSelectId}" class="plan-select-suivi input-style w-full" required disabled>
                 <option value="">Sélectionnez Catégorie/Partenaire...</option>
             </select>
             <div id="${helpTextId}" class="form-text-style rate-info rate-plan-help-suivi"></div>
         </div>
     `;

     container.appendChild(partnerBlockDiv);

     const partnerSelect = partnerBlockDiv.querySelector(`#${partnerSelectId}`);
     const planSelect = partnerBlockDiv.querySelector(`#${planSelectId}`);
     const helpTextElement = partnerBlockDiv.querySelector(`#${helpTextId}`);


      // Peuple le select partenaire
     const sortedPartners = [...getAllPartners()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })); // Utilise données API
     populateDropdown(partnerSelectId, new Set(sortedPartners), "Sélectionner un partenaire"); // Utilise utilitaire


     // Attache listeners au nouveau bloc
     partnerSelect.addEventListener('change', () => {
          console.log(`SUIVI: Partenaire changé dans bloc ${comparisonBlockCounter}: ${partnerSelect.value}`);
          // Met à jour les options de plan pour CE bloc
          updateComparisonPlanOptionsSuivi(partnerBlockDiv);
          // Réinitialise la sélection du plan
          planSelect.value = "";
          updateRatePlanHelpSuivi(planSelect.value, helpTextElement); // Met à jour l'aide
          // Active le select plan si un partenaire est sélectionné ET si une catégorie est sélectionnée
           const selectedCategory = getElementValue('suivi-room-category'); // Utilise utilitaire
           planSelect.disabled = !partnerSelect.value || !selectedCategory || planSelect.querySelectorAll('option').length <= 1;
     });

     // Listener pour le bouton supprimer (si présent)
     const removeBtn = partnerBlockDiv.querySelector('.remove-btn');
     if (removeBtn) {
         removeBtn.addEventListener('click', () => {
             console.log(`SUIVI: Suppression du bloc ${blockId}`);
             container.removeChild(partnerBlockDiv);
             comparisonBlockCounter--; // Décrémente le compteur
             // Rend le bouton Ajouter visible si on repasse en dessous de la limite
             if (comparisonBlockCounter < 4) { // Assurez-vous que cette limite correspond à celle dans le listener d'ajout
                  document.getElementById('suivi-addPartnerBtn').classList.remove('hidden');
             }
             // Optionnel: re-déterminer les numéros des blocs restants pour qu'ils soient consécutifs ? Moins important que la suppression.
         });
     }

     // Mettre à jour les options de plan initiales (dépend de la catégorie déjà sélectionnée)
     // Fait après l'attachement des listeners pour qu'ils soient actifs quand la catégorie est choisie
     updateComparisonPlanOptionsSuivi(partnerBlockDiv);

      // Assure que le bouton Ajouter est visible si on est en dessous de la limite après ajout
     if (comparisonBlockCounter < 4) { // Assurez-vous que cette limite correspond à celle dans le listener d'ajout
         document.getElementById('suivi-addPartnerBtn').classList.remove('hidden');
     } else {
         document.getElementById('suivi-addPartnerBtn').classList.add('hidden');
     }

}


// Cette fonction est appelée lorsque la catégorie change ou lors de l'ajout d'un bloc
function updateAllComparisonPlanOptions() {
     // Appelle updateComparisonPlanOptionsSuivi pour chaque bloc partenaire/plan
     const comparisonBlocks = document.querySelectorAll('#partnerComparisonsContainer .partner-comparison-block');
     comparisonBlocks.forEach(block => {
          updateComparisonPlanOptionsSuivi(block);
     });
}


function updateRatePlanHelpSuivi(planCode, helpTextElement) {
    if (helpTextElement) {
        const description = ratePlanDescriptions[planCode]; // Utilise données API
        helpTextElement.textContent = description || (planCode ? '' : ''); // Affiche description ou rien
    }
}


async function handleSuiviFormSubmit(event) {
     event.preventDefault();
     console.log("SUIVI: Formulaire soumis.");

     const resultContainer = document.getElementById('suivi-result-container');
     hideResult('suivi-result-container'); // Utilise utilitaire // Cache anciens résultats
     showLoading('suivi-result-container', "Génération de la comparaison..."); // Utilise utilitaire // Message de traitement

     // Récupérer les données du formulaire
     const dateDebut = getElementValue('suivi-dateDebut'); // Utilise utilitaire
     const dateFin = getElementValue('suivi-dateFin'); // Utilise utilitaire
     const categorie = getElementValue('suivi-room-category'); // Utilise utilitaire
     const chartType = getElementValue('suivi-chartType'); // Utilise utilitaire

     const comparisonItems = []; // [{ partner: "...", plan: "..." }, ...]
     const comparisonBlocks = document.querySelectorAll('#partnerComparisonsContainer .partner-comparison-block');

     comparisonBlocks.forEach(block => {
         const partnerSelect = block.querySelector('.partner-select-suivi');
         const planSelect = block.querySelector('.plan-select-suivi');
         if (partnerSelect?.value && planSelect?.value) {
             comparisonItems.push({
                 partner: partnerSelect.value,
                 plan: planSelect.value
             });
         }
     });

     // Validation basique
     if (!dateDebut || !dateFin || !categorie) {
         showAppMessage('suivi-global-message-area', 'Veuillez sélectionner une période et une catégorie.', 'warning'); // Utilise utilitaire
          hideResult('suivi-result-container'); // Cache le loading
         return;
     }
     if (comparisonItems.length < 2) {
         showAppMessage('suivi-global-message-area', 'Veuillez ajouter et sélectionner au moins deux plans à comparer.', 'warning'); // Utilise utilitaire
          hideResult('suivi-result-container'); // Cache le loading
         return;
     }

     // Vérifier que tous les plans sont différents
     const selectedPlanKeys = comparisonItems.map(item => `${item.partner}-${item.plan}`);
     const uniquePlanKeys = new Set(selectedPlanKeys);
     if (uniquePlanKeys.size !== selectedPlanKeys.length) {
          showAppMessage('suivi-global-message-area', 'Veuillez sélectionner des combinaisons Partenaire/Plan uniques pour chaque élément de comparaison.', 'warning'); // Utilise utilitaire
           hideResult('suivi-result-container'); // Cache le loading
          return;
     }


     let stayDates;
     try {
          // Calcule le nombre de jours inclus (Date Fin - Date Début + 1 jour)
          const startDate = new Date(dateDebut + 'T00:00:00Z');
          const endDate = new Date(dateFin + 'T00:00:00Z');
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error("Dates invalides");
          if (startDate > endDate) throw new Error("La date de fin doit être après la date de début.");

          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // Utilise floor pour éviter les problèmes d'heure locale/DST
          if (diffDays < 1) throw new Error("La période doit contenir au moins un jour.");

          // Génère les dates en utilisant le nombre de jours calculé
          stayDates = generateStayDates(dateDebut, diffDays); // Utilise utilitaire

     } catch (e) {
         showAppMessage('suivi-global-message-area', `Erreur dates: ${e.message}`, 'error'); // Utilise utilitaire
         hideResult('suivi-result-container'); // Utilise utilitaire // Cache le loading
         return;
     }

     // Assure que les données sont chargées (devrait l'être à l'initialisation, mais sécurité)
     const baseRatesExist = getBaseRates().size > 0; // Utilise données API
     const travcoRatesExist = getTravcoBaseRates().size > 0; // Utilise données API

     if (!baseRatesExist && !travcoRatesExist) {
          showAppMessage('suivi-global-message-area', "Données de tarifs indisponibles. Veuillez recharger la page.", "error"); // Utilise utilitaire
           hideResult('suivi-result-container'); // Cache le loading
          return;
     }

     // --- Calcul des Tarifs pour la Période ---
     const comparisonData = []; // [{ date: Date, dateStr: '...', rates: [{partner, plan, rate}, ...] }, ...]
     let missingRateWarning = false;
     let firstMissingDate = null;

     for (const date of stayDates) {
         const dateStr = formatDateLocale(date); // Utilise utilitaire
         const dailyRates = { date: date, dateStr: dateStr, rates: [] };

         comparisonItems.forEach(item => {
             const dailyRate = calculateDailyRate(date, categorie, item.plan); // Utilise logique de calcul

             if (dailyRate === null) {
                 missingRateWarning = true;
                 if (!firstMissingDate) firstMissingDate = dateStr;
                 dailyRates.rates.push({ ...item, rate: null }); // Stocke null si calcul échoue
             } else {
                 dailyRates.rates.push({ ...item, rate: dailyRate });
             }
         });
         comparisonData.push(dailyRates);
     }

     if (missingRateWarning) {
          showAppMessage('suivi-global-message-area', `Attention: Tarif base manquant pour certaines dates (à partir du ${firstMissingDate}). Les tarifs pour ces jours sont affichés comme N/A.`, "warning", 10000); // Utilise utilitaire
     }

      // Cacher le message "Génération..." une fois les calculs terminés
     const processingMessage = document.querySelector('#suivi-global-message-area .alert-info');
     if (processingMessage) { processingMessage.remove(); }


     // --- Génération et Affichage des Résultats ---
     if (comparisonData.length > 0) {
         generateChart(comparisonData, chartType, comparisonItems); // Utilise la fonction de ce script
         updateComparisonTable(comparisonData, comparisonItems); // Utilise la fonction de ce script
         updateDifferenceAnalysis(comparisonData, comparisonItems, dateDebut, dateFin, categorie); // Utilise la fonction de ce script

         resultContainer.classList.remove('hidden'); // Affiche la section résultats
          resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Scroll vers les résultats
         showAppMessage('suivi-global-message-area', 'Comparaison générée avec succès.', 'success', 5000); // Utilise utilitaire

     } else {
         showAppMessage('suivi-global-message-area', "Aucune donnée générée pour la comparaison. Vérifiez la période et les plans sélectionnés.", "warning"); // Utilise utilitaire
          hideResult('suivi-result-container'); // Cache le loading si pas de données
     }
}


function generateChart(data, chartType, comparisonItems) {
     const ctx = document.getElementById('tarifsChart')?.getContext('2d');
     if (!ctx) { console.error("SUIVI: Canvas pour graphique introuvable."); return; }

     // Détruire l'ancien graphique s'il existe
     if (tarifsChart) {
         tarifsChart.destroy();
     }

     const labels = data.map(day => day.dateStr); // Utilise utilitaire
     const datasets = comparisonItems.map((item, index) => {
         const rates = data.map(day => {
              const rateEntry = day.rates.find(r => r.partner === item.partner && r.plan === item.plan);
              return rateEntry ? rateEntry.rate : null; // Utilise null pour les jours sans tarif
         });
         const color = getDatasetColor(index); // Utilise la fonction de ce script

         return {
             label: `${item.partner} (${item.plan})`,
             data: rates,
             borderColor: color,
             backgroundColor: chartType === 'area' ? color + '40' : color, // Couleur transparente pour l'aire
             borderWidth: 2,
             tension: chartType === 'line' || chartType === 'area' ? 0.1 : 0, // Courbe pour ligne/aire
             fill: chartType === 'area' ? 'origin' : false, // Remplir sous la courbe pour l'aire
             pointRadius: 3, // Taille des points
             pointHoverRadius: 5,
             spanGaps: true // Relier les points même s'il y a des données nulles entre eux
         };
     });

     tarifsChart = new Chart(ctx, {
         type: chartType === 'area' ? 'line' : chartType, // 'area' est un type de ligne avec remplissage
         data: { labels, datasets },
         options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: {
                 legend: {
                     position: 'top',
                     labels: { color: '#e2e8f0', font: { size: 14 } }
                 },
                 tooltip: {
                     mode: 'index',
                     intersect: false,
                     backgroundColor: 'rgba(30, 41, 59, 0.9)', // darker-charcoal semi-transparent
                     titleColor: '#f97316', // vibrant-orange
                     bodyColor: '#e2e8f0', // slate-200
                     borderColor: '#4a5568', // medium-charcoal
                     borderWidth: 1,
                     caretPadding: 10,
                     callbacks: {
                          label: context => {
                               const label = context.dataset.label || '';
                               if (context.parsed.y !== null) {
                                    return `${label}: ${context.parsed.y.toFixed(2)} €`;
                               }
                               return `${label}: N/A`;
                          },
                          title: context => context[0].label // Affiche la date comme titre
                     }
                 }
             },
             scales: {
                 x: {
                     grid: { color: '#4a5568' }, // medium-charcoal grid lines
                     ticks: { color: '#94a3b8' } // slate-400 tick labels
                 },
                 y: {
                     grid: { color: '#4a5568' },
                     ticks: {
                         color: '#94a3b8',
                         callback: value => {
                             if (value === null) return 'N/A';
                             return `${value} €`;
                         }
                     },
                     beginAtZero: true // Commence l'axe Y à zéro
                 }
             }
         }
     });
 }


function updateComparisonTable(data, comparisonItems) {
     const comparisonDiv = document.getElementById('suivi-comparisonTable');
     if (!comparisonDiv) { console.error("SUIVI: Élément #suivi-comparisonTable introuvable."); return; }

     // Générer les en-têtes du tableau
     let headerCells = comparisonItems.map(item => `<th class="px-4 py-3 text-left">${item.partner} (${item.plan})</th>`).join('');

     // Générer les lignes du tableau
     let rows = data.map(day => {
         // Trouver le min/max pour ce jour parmi les tarifs disponibles (non null)
         const validRates = day.rates.map(r => r.rate).filter(rate => rate !== null);
         const minRate = validRates.length > 0 ? Math.min(...validRates) : null;
         const maxRate = validRates.length > 0 ? Math.max(...validRates) : null;

         let rowCells = day.rates.map(rateInfo => {
             let cellClass = 'px-4 py-3 text-right font-mono';
             let cellContent = rateInfo.rate !== null ? `${rateInfo.rate.toFixed(2)} €` : '<span class="italic text-xs text-gray-500">N/A</span>';

             if (rateInfo.rate !== null) {
                 if (minRate !== null && rateInfo.rate === minRate && minRate !== maxRate) { // minRate !== maxRate pour éviter de marquer tout en vert si tous les tarifs sont identiques
                     cellClass += ' text-accent-green font-semibold';
                 } else if (maxRate !== null && rateInfo.rate === maxRate && minRate !== maxRate) {
                     cellClass += ' text-accent-red font-semibold';
                 }
             }

             return `<td class="${cellClass}">${cellContent}</td>`;
         }).join('');

         return `
             <tr class="border-b border-gray-700">
                 <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">${day.dateStr}</td>
                 ${rowCells}
             </tr>
         `;
     }).join('');

      // Calcul des totaux
      const totals = comparisonItems.map((item, index) => {
           return data.reduce((sum, day) => {
                const rateEntry = day.rates.find(r => r.partner === item.partner && r.plan === item.plan);
                return sum + (rateEntry && rateEntry.rate !== null ? rateEntry.rate : 0);
           }, 0);
      });
      const totalCells = totals.map(total => `<td class="px-4 py-3 text-right text-sm font-semibold font-mono">${total.toFixed(2)} €</td>`).join('');


     comparisonDiv.innerHTML = `
         <table class="min-w-full divide-y divide-gray-700 table">
             <thead class="bg-darker-charcoal text-light-orange">
                 <tr>
                     <th class="px-4 py-3 text-left text-sm">Date</th>
                     ${headerCells}
                 </tr>
             </thead>
             <tbody class="divide-y divide-gray-700 bg-charcoal-dark/40">
                 ${rows}
             </tbody>
             <tfoot class="bg-darker-charcoal/80 font-semibold text-gray-100">
                 <tr class="border-t-2 border-gray-600">
                      <td class="px-4 py-3 text-sm text-left">Total Séjour</td>
                      ${totalCells}
                 </tr>
              </tfoot>
         </table>
     `;
 }


function updateDifferenceAnalysis(data, comparisonItems, dateDebutStr, dateFinStr, categorie) {
     const analysisDiv = document.getElementById('suivi-differenceAnalysis');
     if (!analysisDiv) { console.error("SUIVI: Élément #suivi-differenceAnalysis introuvable."); return; }

     analysisDiv.innerHTML = ''; // Vide l'ancien contenu

     if (data.length === 0 || comparisonItems.length === 0) {
         analysisDiv.innerHTML = '<p class="text-gray-400">Aucune donnée pour l\'analyse.</p>';
         return;
     }

     // Calculer les stats pour chaque item de comparaison
     const itemStats = comparisonItems.map(item => {
         const rates = data.map(day => {
              const rateEntry = day.rates.find(r => r.partner === item.partner && r.plan === item.plan);
              return rateEntry ? rateEntry.rate : null;
         }).filter(rate => rate !== null); // Filtre les tarifs null

         if (rates.length === 0) {
              return { ...item, hasData: false };
         }

         const sum = rates.reduce((total, rate) => total + rate, 0);
         const average = sum / rates.length;
         const minRate = Math.min(...rates);
         const maxRate = Math.max(...rates);

          // Trouver la date(s) du min et max
          const minDates = data.filter(day => {
               const rateEntry = day.rates.find(r => r.partner === item.partner && r.plan === item.plan);
               return rateEntry && rateEntry.rate === minRate;
          }).map(day => day.dateStr); // Utilise utilitaire

          const maxDates = data.filter(day => {
               const rateEntry = day.rates.find(r => r.partner === item.partner && r.plan === item.plan);
               return rateEntry && rateEntry.rate === maxRate;
          }).map(day => day.dateStr); // Utilise utilitaire


         return {
             ...item,
             hasData: true,
             average: average,
             minRate: minRate,
             maxRate: maxRate,
             minDates: minDates,
             maxDates: maxDates,
             validDaysCount: rates.length // Nombre de jours avec un tarif valide
         };
     });

     // Générer l'HTML pour chaque item
     const analysisHtml = itemStats.map(stats => {
          if (!stats.hasData) {
               return `
                   <div class="bg-slate-700 rounded-lg p-4 shadow border border-gray-700">
                       <h5 class="font-medium mb-2 text-light-orange">${stats.partner} (${stats.plan})</h5>
                       <p class="text-gray-400 text-sm italic">Pas de données disponibles pour cette combinaison Partenaire/Plan sur la période.</p>
                   </div>
               `;
          }

         const dateDebutLocale = formatDateLocale(new Date(dateDebutStr + 'T00:00:00Z')); // Utilise utilitaire
         const dateFinLocale = formatDateLocale(new Date(dateFinStr + 'T00:00:00Z')); // Utilise utilitaire

         return `
             <div class="bg-slate-700 rounded-lg p-4 shadow border border-gray-700">
                 <h5 class="font-medium mb-2 text-light-orange">${stats.partner} (<span class="text-gray-300">${stats.plan}</span>)</h5>
                 <p class="text-gray-300 text-sm">
                     Pour une chambre <span class="font-semibold">${categorie}</span> entre le ${dateDebutLocale} et le ${dateFinLocale} :
                 </p>
                 <ul class="text-gray-400 text-sm mt-2 space-y-1">
                     <li>Tarif moyen sur ${stats.validDaysCount} jour(s) : <span class="font-semibold text-gray-100">${stats.average.toFixed(2)} €</span></li>
                     <li>Tarif le plus bas : <span class="font-semibold text-accent-green">${stats.minRate.toFixed(2)} €</span> (le${stats.minDates.length > 1 ? 's' : ''} ${stats.minDates.join(', ')})</li>
                     <li>Tarif le plus haut : <span class="font-semibold text-accent-red">${stats.maxRate.toFixed(2)} €</span> (le${stats.maxDates.length > 1 ? 's' : ''} ${stats.maxDates.join(', ')})</li>
                 </ul>
             </div>
         `;
     }).join('');

     analysisDiv.innerHTML = analysisHtml;
 }

function getDatasetColor(index) {
    const colors = [
        '#f97316', // vibrant-orange
        '#3b82f6', // accent-blue
        '#10b981', // accent-green
        '#8b5cf6', // violet
        '#facc15', // accent-yellow
        '#ef4444', // accent-red
        '#64748b', // slate-600
        '#a3e635', // lime-400
        '#22d3ee', // cyan-400
        '#e879f9'  // fuchsia-400
    ];
    return colors[index % colors.length];
}

function resetSuiviForm() {
    console.log("SUIVI: Réinitialisation du formulaire...");
    const form = document.getElementById('suiviForm');
    if (form) {
         form.reset(); // Réinitialise les champs standard
         // Réinitialise les dates par défaut
         try {
             const today = new Date();
             const oneWeekLater = new Date();
             oneWeekLater.setUTCDate(today.getUTCDate() + 7);
             document.getElementById('suivi-dateDebut').value = formatDateYYYYMMDD(today); // Utilise utilitaire
             document.getElementById('suivi-dateFin').value = formatDateYYYYMMDD(oneWeekLater); // Utilise utilitaire
         } catch(e) {console.error("SUIVI: Erreur réinitialisation dates:", e);}


         // Supprime tous les blocs de comparaison sauf les deux premiers
         const container = document.getElementById('partnerComparisonsContainer');
         if (container) {
             const blocks = container.querySelectorAll('.partner-comparison-block');
             for (let i = blocks.length - 1; i >= 2; i--) { // Commence à partir du 3ème bloc
                  container.removeChild(blocks[i]);
             }
         }
         comparisonBlockCounter = 2; // Réinitialise le compteur pour qu'il y ait 2 blocs

         // Réinitialise le contenu des 2 premiers blocs
         const firstTwoBlocks = container.querySelectorAll('.partner-comparison-block');
         firstTwoBlocks.forEach(block => {
              const partnerSelect = block.querySelector('.partner-select-suivi');
              const planSelect = block.querySelector('.plan-select-suivi');
              const helpTextElement = block.querySelector('.rate-plan-help-suivi');

              if (partnerSelect) {
                   partnerSelect.value = "";
                   // Ré-peuple le partenaire dropdown si nécessaire (déjà fait à l'init)
              }
              if (planSelect) {
                   // Réinitialise le plan dropdown
                   populateDropdown(planSelect.id, new Set(), "Sélectionnez Catégorie/Partenaire..."); // Utilise utilitaire
                   planSelect.value = "";
                   planSelect.disabled = true;
                   updateRatePlanHelpSuivi(planSelect.value, helpTextElement);
              }
         });

         // Cache les résultats et les alertes
         hideResult('suivi-result-container'); // Utilise utilitaire
         document.getElementById('suivi-global-message-area').innerHTML = ''; // Vide la zone d'alertes spécifiques à la page

         // Réinitialise le graphique
         if (tarifsChart) {
              tarifsChart.destroy();
              tarifsChart = null; // S'assure que la variable est null
              // Réinitialise le canvas pour un futur graphique
              const chartContainer = document.querySelector('.chart-container');
              if (chartContainer) {
                   chartContainer.innerHTML = '<canvas id="tarifsChart"></canvas>';
              }
         }

         // Réinitialise le select Catégorie et déclenche la mise à jour des plans
         const categorySelect = document.getElementById('suivi-room-category');
         if (categorySelect) {
              categorySelect.value = ""; // Réinitialise la catégorie
              updateRoomCategoryOptionsSuivi(); // Déclenche la mise à jour des plans dans les blocs
         }

         // Assure que le bouton Ajouter est visible
         document.getElementById('suivi-addPartnerBtn')?.classList.remove('hidden');

          showAppMessage('suivi-global-message-area', 'Formulaire réinitialisé.', 'success', 3000); // Utilise utilitaire

    } else {
        console.error("SUIVI: Formulaire suiviForm introuvable pour réinitialisation.");
    }
}

// --- Initialisation du graphique (Structure vide) ---
function initializeChart() {
    // L'instance du graphique est créée dans generateChart,
    // on s'assure juste que le canvas existe.
    const canvas = document.getElementById('tarifsChart');
    if (!canvas) {
        console.error("SUIVI: Canvas 'tarifsChart' introuvable au moment de l'initialisation du chart.");
        // Tenter de recréer le canvas si le conteneur existe
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
             chartContainer.innerHTML = '<canvas id="tarifsChart"></canvas>';
             console.log("SUIVI: Canvas 'tarifsChart' recréé.");
        }
    }
}