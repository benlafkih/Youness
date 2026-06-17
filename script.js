// ============================================================
//  CONFIGURATION FIREBASE (remplacez par vos propres valeurs)
// ============================================================
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================================
//  VARIABLES GLOBALES
// ============================================================
let allSchools = [];
let filteredSchools = [];
let currentAverage = 0;
let currentStream = '';

// Éléments DOM
const elements = {
    form: document.getElementById('orientationForm'),
    fullName: document.getElementById('fullName'),
    regionalGrade: document.getElementById('regionalGrade'),
    nationalGrade: document.getElementById('nationalGrade'),
    stream: document.getElementById('stream'),
    calculateBtn: document.getElementById('calculateBtn'),
    resultsContainer: document.getElementById('resultsContainer'),
    averageDisplay: document.getElementById('averageDisplay'),
    streamDisplay: document.getElementById('streamDisplay'),
    searchInput: document.getElementById('searchInput'),
    cityFilter: document.getElementById('cityFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    schoolsList: document.getElementById('schoolsList'),
    resultCount: document.getElementById('resultCount'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    // Admin
    totalUsers: document.getElementById('totalUsers'),
    totalCalculations: document.getElementById('totalCalculations'),
    totalSchools: document.getElementById('totalSchools'),
    todayCalculations: document.getElementById('todayCalculations'),
    adminSearchInput: document.getElementById('adminSearchInput'),
    studentsTableBody: document.getElementById('studentsTableBody'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    refreshAdminBtn: document.getElementById('refreshAdminBtn'),
    themeToggle: document.getElementById('themeToggle'),
    navTabs: document.querySelectorAll('.nav-tab'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn')
};

// ============================================================
//  CHARGEMENT DES ÉCOLES DEPUIS schools.json
// ============================================================
async function loadSchools() {
    showLoading(true);
    try {
        const response = await fetch('schools.json');
        if (!response.ok) throw new Error('Impossible de charger schools.json');
        const data = await response.json();
        allSchools = data;
        populateCityFilter();
        elements.totalSchools.textContent = allSchools.length;
    } catch (error) {
        console.error('Erreur chargement écoles:', error);
        alert('Erreur lors du chargement des données écoles. Vérifiez le fichier schools.json.');
    } finally {
        showLoading(false);
    }
}

function populateCityFilter() {
    const cities = [...new Set(allSchools.map(s => s.city).filter(Boolean))].sort();
    const select = elements.cityFilter;
    select.innerHTML = '<option value="">Toutes les villes</option>';
    cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        select.appendChild(opt);
    });
}

// ============================================================
//  GESTION DU THEME (clair/sombre)
// ============================================================
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const newTheme = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    elements.themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', newTheme);
}
// Appliquer le thème sauvegardé
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
elements.themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
elements.themeToggle.addEventListener('click', toggleTheme);

// ============================================================
//  NAVIGATION ONGLETS
// ============================================================
elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        elements.navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        document.getElementById(tabId + 'Tab').classList.add('active');
        if (tabId === 'admin') refreshAdmin();
    });
});

// Mobile menu : toggle nav-links (pour les petits écrans)
elements.mobileMenuBtn.addEventListener('click', () => {
    const links = document.querySelector('.nav-links');
    links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
});

// ============================================================
//  CALCUL ET AFFICHAGE
// ============================================================
function calculateAverage(regional, national) {
    return (0.25 * regional) + (0.75 * national);
}

function getProbability(average, threshold) {
    if (average >= threshold) return 'high';
    if (average >= threshold - 0.5) return 'medium';
    return 'low';
}

function renderSchools(schools) {
    const container = elements.schoolsList;
    if (!schools || schools.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune école correspondante.</p>';
        elements.resultCount.textContent = '0 écoles trouvées';
        return;
    }
    let html = '';
    schools.forEach(school => {
        const thresholds = school.thresholds || [];
        // On prend le seuil le plus récent (dernière année) pour la probabilité
        const lastThreshold = thresholds.length > 0 ? thresholds[thresholds.length - 1].value : null;
        let prob = 'low';
        let probLabel = 'Faible chance';
        let probClass = 'prob-low';
        if (lastThreshold !== null && lastThreshold !== undefined) {
            const p = getProbability(currentAverage, lastThreshold);
            prob = p;
            if (p === 'high') { probLabel = 'Haute chance'; probClass = 'prob-high'; }
            else if (p === 'medium') { probLabel = 'Chance moyenne'; probClass = 'prob-medium'; }
            else { probLabel = 'Faible chance'; probClass = 'prob-low'; }
        }
        // Construire l'affichage des seuils
        let thresholdsHtml = '';
        if (thresholds.length > 0) {
            thresholdsHtml = thresholds.map(t =>
                `<span><strong>${t.year}</strong> : ${t.value}/20</span>`
            ).join(' • ');
        } else {
            thresholdsHtml = 'Non disponible';
        }

        html += `
            <div class="school-card">
                <h3>${school.name}</h3>
                <div class="school-meta">
                    <span><i class="fas fa-city"></i> ${school.city || 'N/A'}</span>
                    <span><i class="fas fa-tag"></i> ${school.category || 'N/A'}</span>
                </div>
                <div class="thresholds">
                    <strong>Seuils (5 ans) :</strong> ${thresholdsHtml}
                </div>
                <span class="probability ${probClass}">${probLabel}</span>
            </div>
        `;
    });
    container.innerHTML = html;
    elements.resultCount.textContent = `${schools.length} écoles trouvées`;
}

function filterSchools() {
    const search = elements.searchInput.value.toLowerCase().trim();
    const city = elements.cityFilter.value;
    const category = elements.categoryFilter.value;

    let results = allSchools.filter(school => {
        const streamMatch = school.streams && school.streams.includes(currentStream);
        if (!streamMatch) return false;
        // Filtres
        const nameMatch = school.name.toLowerCase().includes(search);
        const cityMatch = city === '' || school.city === city;
        const catMatch = category === '' || school.category === category;
        return nameMatch && cityMatch && catMatch;
    });
    filteredSchools = results;
    renderSchools(results);
}

// ============================================================
//  SOUMISSION DU FORMULAIRE
// ============================================================
elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = elements.fullName.value.trim();
    const regional = parseFloat(elements.regionalGrade.value);
    const national = parseFloat(elements.nationalGrade.value);
    const stream = elements.stream.value;

    if (!fullName || isNaN(regional) || isNaN(national) || !stream) {
        alert('Veuillez remplir tous les champs correctement.');
        return;
    }
    if (regional < 0 || regional > 20 || national < 0 || national > 20) {
        alert('Les notes doivent être comprises entre 0 et 20.');
        return;
    }

    const avg = calculateAverage(regional, national);
    currentAverage = avg;
    currentStream = stream;

    // Affichage
    elements.averageDisplay.textContent = avg.toFixed(2);
    elements.streamDisplay.textContent = `Filière : ${stream}`;
    elements.resultsContainer.style.display = 'block';

    // Sauvegarde dans Firestore
    try {
        await db.collection('students').add({
            fullName: fullName,
            regionalGrade: regional,
            nationalGrade: national,
            average: avg,
            stream: stream,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erreur Firestore:', error);
        alert('Erreur lors de l\'enregistrement. Vérifiez la configuration Firebase.');
    }

    // Filtrer et afficher
    filterSchools();
});

// Écoute des filtres
elements.searchInput.addEventListener('input', filterSchools);
elements.cityFilter.addEventListener('change', filterSchools);
elements.categoryFilter.addEventListener('change', filterSchools);

// ============================================================
//  ADMIN DASHBOARD
// ============================================================
let adminStudents = [];

async function refreshAdmin() {
    showLoading(true);
    try {
        // Statistiques
        const snapshot = await db.collection('students').get();
        const docs = snapshot.docs;
        const total = docs.length;
        const uniqueNames = new Set(docs.map(d => d.data().fullName)).size;
        elements.totalUsers.textContent = uniqueNames;
        elements.totalCalculations.textContent = total;

        // Aujourd'hui
        const today = new Date();
        today.setHours(0,0,0,0);
        let todayCount = 0;
        const todayStr = today.toISOString().split('T')[0];
        docs.forEach(doc => {
            const data = doc.data();
            if (data.createdAt) {
                const d = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (d.toISOString().split('T')[0] === todayStr) todayCount++;
            }
        });
        elements.todayCalculations.textContent = todayCount;

        // Récupérer toutes les données pour la table
        adminStudents = docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                fullName: data.fullName || '',
                stream: data.stream || '',
                regionalGrade: data.regionalGrade || 0,
                nationalGrade: data.nationalGrade || 0,
                average: data.average || 0,
                createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date()
            };
        });
        renderAdminTable(adminStudents);
    } catch (error) {
        console.error('Erreur admin:', error);
        alert('Erreur lors du chargement des données admin.');
    } finally {
        showLoading(false);
    }
}

function renderAdminTable(students) {
    const tbody = elements.studentsTableBody;
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Aucun étudiant enregistré.</td></tr>';
        return;
    }
    let html = '';
    students.forEach(s => {
        const dateStr = s.createdAt.toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        html += `
            <tr>
                <td>${s.fullName}</td>
                <td>${s.stream}</td>
                <td>${s.regionalGrade.toFixed(2)}</td>
                <td>${s.nationalGrade.toFixed(2)}</td>
                <td>${s.average.toFixed(2)}</td>
                <td>${dateStr}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Recherche admin
elements.adminSearchInput.addEventListener('input', () => {
    const query = elements.adminSearchInput.value.toLowerCase().trim();
    if (!query) {
        renderAdminTable(adminStudents);
        return;
    }
    const filtered = adminStudents.filter(s => s.fullName.toLowerCase().includes(query));
    renderAdminTable(filtered);
});

// Export CSV
elements.exportCsvBtn.addEventListener('click', () => {
    if (adminStudents.length === 0) return alert('Aucune donnée à exporter.');
    const headers = ['Nom', 'Filière', 'Régional', 'National', 'Moyenne', 'Date'];
    const rows = adminStudents.map(s => [
        s.fullName,
        s.stream,
        s.regionalGrade.toFixed(2),
        s.nationalGrade.toFixed(2),
        s.average.toFixed(2),
        s.createdAt.toLocaleString('fr-FR')
    ]);
    let csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'etudiants_benlafkih.csv';
    link.click();
});

elements.refreshAdminBtn.addEventListener('click', refreshAdmin);

// ============================================================
//  UTILITAIRES
// ============================================================
function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// ============================================================
//  INIT
// ============================================================
(async function init() {
    await loadSchools();
    // Pré-remplir les filtres de catégories (déjà dans le HTML)
    // Si l'admin est activé, on peut charger les données après un clic sur l'onglet.
    // On charge les stats au premier affichage de l'admin
    // On attache un écouteur pour le moment où l'onglet admin devient actif
    // déjà géré par le click sur les onglets
})();
