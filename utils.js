// --- START OF FILE utils.js ---

/**
 * Affiche un message d'alerte dans une zone spécifiée.
 * @param {string} containerId L'ID de l'élément conteneur où afficher le message.
 * @param {string} message Le message à afficher.
 * @param {string} type Le type d'alerte ('info', 'success', 'warning', 'error').
 * @param {number} duration Durée d'affichage en ms (0 pour persistant).
 */
export function showAppMessage(containerId, message, type = 'info', duration = 7000) {
    const messageArea = document.getElementById(containerId);
    if (!messageArea) { console.error(`ERREUR: Zone de message '${containerId}' non trouvée !`); alert(`Erreur: ${message}`); return; }

    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`; // ID unique
    let alertClass = 'alert-error'; // Défaut
    let iconClass = 'fa-exclamation-circle';
    switch (type) {
        case 'success': alertClass = 'alert-success'; iconClass = 'fa-check-circle'; break;
        case 'warning': alertClass = 'alert-warning'; iconClass = 'fa-exclamation-triangle'; break;
        case 'info': alertClass = 'alert-info'; iconClass = 'fa-info-circle'; break;
    }
    // Utilisez les classes CSS définies dans style.css ou suivi_tarifs.css pour .alert et les alert-types
    const alertHtml = `<div id="${alertId}" class="alert ${alertClass} fade-in" role="alert">
        <i class="fas ${iconClass} mr-3"></i>
        <span class="flex-grow">${message.replace(/\n/g, '<br>')}</span>
        <button type="button" class="ml-auto close-alert-button" aria-label="Close">
            <span class="sr-only">Close</span><i class="fas fa-times"></i>
        </button>
    </div>`;

    messageArea.insertAdjacentHTML('beforeend', alertHtml);
    const alertElement = messageArea.querySelector(`#${alertId}`);
    if (alertElement) {
        const closeButton = alertElement.querySelector(`.close-alert-button`);
        if (closeButton) { closeButton.addEventListener('click', () => alertElement.remove()); }
        if (duration > 0) { setTimeout(() => { alertElement.style.opacity = '0'; setTimeout(() => alertElement.remove(), 300); }, duration); }
    }
}


export function showLoading(elementId, message = "Chargement...") {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="loading-indicator">${message} <i class="fas fa-spinner fa-spin"></i></div>`;
        element.classList.remove('hidden');
    } else { console.warn(`showLoading: Element ID '${elementId}' introuvable.`); }
}

export function hideResult(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
        element.innerHTML = ''; // Vide le contenu
    } else { console.warn(`hideResult: Element ID '${elementId}' introuvable.`); }
}

export function formatDateYYYYMMDD(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) { return null; }
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDateLocale(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) { return "Date invalide"; }
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
    try { return date.toLocaleDateString('fr-FR', options); }
    catch (e) { return formatDateYYYYMMDD(date) || "Date invalide"; }
}

/**
 * Génère une liste de dates UTC pour un séjour.
 * @param {string} arrivalDateString Date d'arrivée 'YYYY-MM-DD'.
 * @param {number} nights Nombre de nuits.
 * @returns {Date[]} Tableau d'objets Date UTC pour chaque nuit.
 * @throws Error si les dates ou nuits sont invalides.
 */
export function generateStayDates(arrivalDateString, nights) {
    if (!arrivalDateString) { throw new Error("Date d'arrivée manquante."); }
    const nightsInt = parseInt(nights, 10);
    if (isNaN(nightsInt) || nightsInt < 1) { throw new Error("Nombre de nuits invalide."); }

    const startDate = new Date(arrivalDateString + 'T00:00:00Z'); // Utilise Z pour UTC
    if (isNaN(startDate.getTime())) { throw new Error("Format de date d'arrivée incorrect ou invalide."); }

    const dates = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < nightsInt; i++) {
        dates.push(new Date(currentDate)); // Ajoute copie de la date du jour
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Passe au jour suivant (UTC)
    }
    return dates;
}


export function getElementValue(id) {
    const element = document.getElementById(id);
    if (!element) { console.warn(`getElementValue: Element ID '${id}' non trouvé.`); return null; }
    return element.value;
}
export function getElementValueAsInt(id) {
    const value = getElementValue(id);
    const parsed = value ? parseInt(value, 10) : NaN;
    return isNaN(parsed) ? null : parsed;
}
export function getElementValueAsFloat(id) {
    const value = getElementValue(id);
    const parsed = value ? parseFloat(String(value).replace(',', '.')) : NaN; // Remplace virgule par point
    return isNaN(parsed) ? null : parsed;
}


/**
 * Peuple un élément select (dropdown) avec des options.
 * @param {string} selectElementId L'ID de l'élément select.
 * @param {Set<string> | string[]} options Options à ajouter.
 * @param {string} defaultText Texte de l'option par défaut/placeholder.
 * @param {boolean} addAllOption Ajouter une option "Tous" ?
 * @param {string} allOptionValue Valeur de l'option "Tous" (souvent "").
 * @param {string} allOptionText Texte de l'option "Tous".
 * @param {string[]} [orderBy] Ordre optionnel des options (par valeur).
 */
export function populateDropdown(selectElementId, optionsSet, defaultText, addAllOption = false, allOptionValue = "", allOptionText = "Tous", orderBy = []) {
    const select = document.getElementById(selectElementId);
    if (!select) { console.error(`Dropdown #${selectElementId} introuvable.`); return; }

    const currentVal = select.value; // Sauvegarde valeur actuelle
    select.innerHTML = ''; // Vide les options
    select.disabled = true; // Désactive pendant remplissage

    // Option par défaut (placeholder)
    const defaultOpt = document.createElement('option');
    defaultOpt.value = "";
    defaultOpt.textContent = defaultText;
    defaultOpt.disabled = true;
    defaultOpt.selected = true; // Sélectionnée par défaut
    select.appendChild(defaultOpt);

    // Option "Tous" si demandée
    if (addAllOption) {
        const allOpt = document.createElement('option');
        allOpt.value = allOptionValue; // Souvent ""
        allOpt.textContent = allOptionText;
        select.appendChild(allOpt);
    }

    // Tri ou ordre spécifique
    let sortedOptions = [...optionsSet];
    if (orderBy.length > 0) {
        // Utilise l'ordre spécifié, puis alphabétique pour les restantes
        const ordered = orderBy.filter(item => optionsSet.has(item));
        const remaining = sortedOptions.filter(item => !ordered.includes(item)).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        sortedOptions = [...ordered, ...remaining];
    } else {
        // Tri alphabétique par défaut
        sortedOptions.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    }


    // Ajout des options triées/ordonnées
    sortedOptions.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item; // Affiche la valeur brute (nom/code)
        select.appendChild(option);
    });

    // Ré-sélectionne l'ancienne valeur si elle existe toujours
    if (select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
    } else {
        // Sinon, sélectionne "Tous" si présent, sinon le placeholder reste sélectionné
        select.value = addAllOption ? allOptionValue : "";
    }

    // Réactive le select SI il y a des options (ou si c'est le cas "Tous")
    select.disabled = (optionsSet.size === 0 && !addAllOption) || select.length <= 1; // Désactivé si seulement le placeholder est présent (sauf si "Tous" est ajouté)

    // Le cas spécial pour le select partenaire avec "Tous" qui doit toujours être actif est géré par la condition ci-dessus.
}