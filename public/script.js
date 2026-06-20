console.log("Скрипт загружен");

// ========== МАСКА ТЕЛЕФОНА ==========
function phoneMask(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.startsWith('7')) value = '7' + value.slice(1);
    else if (value.startsWith('8')) value = '7' + value.slice(1);
    else if (!value.startsWith('7')) value = '7' + value;
    let formatted = '+7';
    if (value.length > 1) formatted += ' (' + value.substring(1, 4);
    if (value.length >= 5) formatted += ') ' + value.substring(4, 7);
    if (value.length >= 8) formatted += '-' + value.substring(7, 9);
    if (value.length >= 10) formatted += '-' + value.substring(9, 11);
    input.value = formatted;
}

// ========== ЗАГРУЗКА СОТРУДНИКОВ ==========
async function loadStaff() {
    try {
        const res = await fetch('/api/staff');
        const staff = await res.json();
        const swiperWrapper = document.querySelector('.teamSwiper .swiper-wrapper');
        if (!swiperWrapper) return;
        swiperWrapper.innerHTML = staff.map(m => `
            <div class="swiper-slide">
                <div class="slide-grid">
                    <div class="person-photo-block">
                        <div class="person-photo"><img src="${m.photo}" alt="${m.name}"></div>
                        <div class="person-name">${m.name}</div>
                    </div>
                    <div class="person-info">
                        <h3>${m.position}</h3>
                        <div class="person-desc"><p>${m.description}</p></div>
                    </div>
                </div>
            </div>
        `).join('');
        if (typeof Swiper !== 'undefined') {
            new Swiper('.teamSwiper', {
                loop: true,
                slidesPerView: 1,
                navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                pagination: { el: '.swiper-pagination', clickable: true },
                spaceBetween: 0,
                allowTouchMove: true
            });
        }
    } catch(e) { console.error(e); }
}

// ========== ЗАГРУЗКА ВАКАНСИЙ ==========
async function loadVacancies() {
    try {
        const res = await fetch('/api/vacancies');
        const vacs = await res.json();
        const grid = document.getElementById('vacanciesGrid');
        if (!grid) return;
        if (vacs.length === 0) { grid.innerHTML = '<p>Нет активных вакансий</p>'; return; }
        grid.innerHTML = vacs.map(v => `
            <div class="vacancy-card" data-title="${v.title}">
                <i class="${v.icon}"></i>
                <h3>${v.title}</h3>
                <p>${v.description}</p>
                <div class="click-hint"><i class="fas fa-pen-alt"></i> Нажмите</div>
            </div>
        `).join('');
        document.querySelectorAll('.vacancy-card').forEach(card => {
            card.addEventListener('click', () => {
                document.getElementById('modalVacancyTitle').value = card.dataset.title;
                document.getElementById('vacancyModal').style.display = 'flex';
            });
        });
    } catch(e) { console.error(e); }
}

// ========== ЗАГРУЗКА ОТЗЫВОВ (БЕГУЩАЯ СТРОКА) ==========
async function loadReviews() {
    try {
        const res = await fetch('/api/reviews');
        const reviews = await res.json();
        const ticker = document.getElementById('tickerReviews');
        if (!ticker) return;
        const items = [...reviews, ...reviews];
        ticker.innerHTML = items.map(r => `
            <div class="ticker-item">
                <img src="${r.photo}" alt="${r.author}">
                <div><div>“${r.text}”</div><div>— ${r.author}</div></div>
            </div>
        `).join('');
        ticker.style.animationDuration = `${Math.max(30, ticker.scrollWidth / 55)}s`;
    } catch(e) { console.error(e); }
}

// ========== ТЁМНАЯ ТЕМА ==========
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
}

// ========== КАРТА ==========
if (typeof L !== 'undefined') {
    const mapElement = document.getElementById('map');
    if (mapElement) {
        const map = L.map('map').setView([55.164, 61.436], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);
        L.marker([55.164, 61.436]).addTo(map).bindPopup('PeKom, ул. Бажова, 91').openPopup();
    }
}

// ========== МОДАЛЬНОЕ ОКНО ==========
const modal = document.getElementById('vacancyModal');
const closeBtn = document.querySelector('.close-modal');
if (closeBtn && modal) {
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

// ========== ЛОГИКА ПОЛЯ ОПЫТА ==========
const hasExperienceSelect = document.getElementById('hasExperience');
const experienceTextBlock = document.getElementById('experienceTextBlock');
if (hasExperienceSelect && experienceTextBlock) {
    hasExperienceSelect.addEventListener('change', () => {
        if (hasExperienceSelect.value === 'yes') {
            experienceTextBlock.style.display = 'block';
            document.getElementById('experience').required = true;
        } else {
            experienceTextBlock.style.display = 'none';
            document.getElementById('experience').required = false;
        }
    });
}

// ========== МАСКА ТЕЛЕФОНА (ПРИ ВВОДЕ) ==========
const phoneInput = document.getElementById('phone');
if (phoneInput) phoneInput.addEventListener('input', () => phoneMask(phoneInput));

// ========== ВАЛИДАЦИЯ EMAIL ==========
const emailInput = document.getElementById('email');
if (emailInput) {
    emailInput.addEventListener('input', () => {
        const val = emailInput.value;
        const isValid = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(val);
        emailInput.style.borderColor = (val === '' || isValid) ? '' : '#f00';
    });
}

// ========== ОТПРАВКА ФОРМЫ ==========
const form = document.getElementById('applicationForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vacancy = document.getElementById('modalVacancyTitle').value;
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;
        const hasExp = document.getElementById('hasExperience').value;
        let experience = '';

        // Валидация ФИО (только буквы, пробелы, дефисы)
        const nameRegex = /^[A-Za-zА-Яа-яёЁ\s\-]+$/;
        if (!nameRegex.test(fullName)) {
            alert('ФИО должно содержать только буквы, пробелы и дефисы');
            return;
        }

        if (hasExp === 'yes') {
            experience = document.getElementById('experience').value.trim();
            if (!experience) {
                alert('Пожалуйста, опишите ваш опыт');
                return;
            }
        } else if (hasExp === 'no') {
            experience = 'Нет опыта';
        } else {
            alert('Укажите, есть ли у вас опыт работы');
            return;
        }

        const captcha = document.getElementById('captcha').value;
        const fileInput = document.getElementById('resumeFile');

        if (!fullName || !phone || !email) {
            alert('Заполните ФИО, телефон и email');
            return;
        }
        if (!/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(email)) {
            alert('Введите корректный email');
            return;
        }
        if (captcha !== '5') {
            alert('Неверный ответ капчи (2+3=5)');
            return;
        }
        if (!fileInput.files.length) {
            alert('Прикрепите резюме (обязательно)');
            return;
        }

        const formData = new FormData();
        formData.append('vacancy', vacancy);
        formData.append('fullName', fullName);
        formData.append('phone', phone);
        formData.append('email', email);
        formData.append('experience', experience);
        formData.append('hasExp', hasExp);
        formData.append('captcha', captcha);
        formData.append('resume', fileInput.files[0]);

        const btn = document.querySelector('.btn-submit');
        const original = btn.innerText;
        btn.innerText = 'Отправка...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/apply', { method: 'POST', body: formData });
            if (res.ok) {
                alert('✅ Заявка отправлена!');
                modal.style.display = 'none';
                form.reset();
                if (experienceTextBlock) experienceTextBlock.style.display = 'none';
                if (phoneInput) phoneInput.value = '';
            } else {
                const err = await res.json();
                alert('❌ Ошибка: ' + (err.error || ''));
            }
        } catch(e) {
            alert('⚠️ Ошибка соединения');
        } finally {
            btn.innerText = original;
            btn.disabled = false;
        }
    });
}

// ========== AOS АНИМАЦИЯ ==========
if (typeof AOS !== 'undefined') AOS.init();

// ========== БУРГЕР-МЕНЮ (ДЛЯ МОБИЛЬНЫХ) ==========
const burger = document.getElementById('burger');
const navLinksMenu = document.getElementById('navLinks');
if (burger && navLinksMenu) {
    // Добавляем крестик, если его нет
    if (!document.querySelector('.close-burger')) {
        const closeBtn = document.createElement('div');
        closeBtn.className = 'close-burger';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.onclick = () => navLinksMenu.classList.remove('show');
        navLinksMenu.prepend(closeBtn);
    }
    burger.onclick = (e) => {
        e.stopPropagation();
        navLinksMenu.classList.toggle('show');
    };
    // Закрытие при клике на ссылки
    navLinksMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => navLinksMenu.classList.remove('show'));
    });
    // Закрытие при клике вне меню
    document.addEventListener('click', (e) => {
        if (!navLinksMenu.contains(e.target) && !burger.contains(e.target)) {
            navLinksMenu.classList.remove('show');
        }
    });
}

// ========== ЗАГРУЗКА ВСЕХ ДАННЫХ ПОСЛЕ DOM ==========
document.addEventListener('DOMContentLoaded', () => {
    loadStaff();
    loadVacancies();
    loadReviews();
});