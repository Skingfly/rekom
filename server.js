const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const nodemailer = require('nodemailer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

// Папки для загрузок
const uploadDir = path.join(__dirname, 'public', 'uploads');
const staffPhotoDir = path.join(uploadDir, 'staff');
const reviewsPhotoDir = path.join(uploadDir, 'reviews');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(staffPhotoDir)) fs.mkdirSync(staffPhotoDir, { recursive: true });
if (!fs.existsSync(reviewsPhotoDir)) fs.mkdirSync(reviewsPhotoDir, { recursive: true });

// Multer для резюме
const resumeStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const uploadResume = multer({ storage: resumeStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Multer для фото сотрудников
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, staffPhotoDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// Multer для фото отзывов
const reviewPhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, reviewsPhotoDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadReviewPhoto = multer({ storage: reviewPhotoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

const db = new sqlite3.Database('./database.sqlite');

// Проверка, настроена ли почта
const isEmailConfigured = () => {
    const email = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    return email && pass && email !== '' && pass !== '';
};

// Инициализация таблиц
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, position TEXT, description TEXT, photo TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS vacancies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, icon TEXT, description TEXT, is_active INTEGER DEFAULT 1
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author TEXT, text TEXT, photo TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vacancy TEXT, fullName TEXT, phone TEXT, email TEXT, experience TEXT, resume_path TEXT, status TEXT DEFAULT 'new', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY, login TEXT UNIQUE, password_hash TEXT
    )`);

    const hash = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO admin (id, login, password_hash) VALUES (1, 'admin', ?)`, [hash]);

    // Демо-данные сотрудников
    db.get(`SELECT COUNT(*) as count FROM staff`, (err, row) => {
        if (row.count === 0) {
            const demoPhotos = ['staff-1.jpg', 'staff-2.jpg', 'staff-3.jpg', 'staff-4.jpg', 'staff-5.jpg', 'staff-6.jpg'];
            demoPhotos.forEach(photo => {
                const demoPath = path.join(staffPhotoDir, photo);
                if (!fs.existsSync(demoPath)) fs.writeFileSync(demoPath, '');
            });
            const staffData = [
                ['Алексей Громов', 'Директор компании', 'Руководит стратегическим развитием, контролирует качество услуг и внедряет инновации.', '/uploads/staff/staff-1.jpg'],
                ['Марина Кравцова', 'Заведующий типографией', 'Организует бесперебойную работу печатного цеха, контролирует соблюдение сроков.', '/uploads/staff/staff-2.jpg'],
                ['Дмитрий Павлов', 'Менеджер по работе с клиентами и персоналом', 'Координирует работу с клиентами, подбирает и обучает персонал.', '/uploads/staff/staff-3.jpg'],
                ['Екатерина Власова', 'Редактор', 'Отвечает за корректуру текстов, контроль грамотности и стилистики.', '/uploads/staff/staff-4.jpg'],
                ['Артём Белов', 'Дизайнер', 'Разрабатывает креативные макеты, фирменный стиль и рекламные материалы.', '/uploads/staff/staff-5.jpg'],
                ['Олег Суханов', 'Монтажер (видеоролики)', 'Профессиональный видеомонтаж, создание динамичных роликов.', '/uploads/staff/staff-6.jpg']
            ];
            const stmt = db.prepare(`INSERT INTO staff (name, position, description, photo) VALUES (?, ?, ?, ?)`);
            staffData.forEach(s => stmt.run(s));
            stmt.finalize();
        }
    });

    // Демо-данные вакансий
    db.get(`SELECT COUNT(*) as count FROM vacancies`, (err, row) => {
        if (row.count === 0) {
            const vac = [
                ['Помощник монтажника', 'fas fa-video', 'Обучение видеомонтажу, помощь в проектах.', 1],
                ['Помощник дизайнера', 'fas fa-palette', 'Вёрстка, подготовка макетов. Знание Photoshop/Illustrator приветствуется.', 1],
                ['Монтажер', 'fas fa-film', 'Опыт от 1 года, работа в Adobe Premiere Pro, After Effects.', 1]
            ];
            const stmt = db.prepare(`INSERT INTO vacancies (title, icon, description, is_active) VALUES (?, ?, ?, ?)`);
            vac.forEach(v => stmt.run(v));
            stmt.finalize();
        } else {
            db.run(`UPDATE vacancies SET icon = 'fas fa-palette' WHERE title = 'Помощник дизайнера'`);
        }
    });

    // Демо-данные отзывов с локальными фото-заглушками
    db.get(`SELECT COUNT(*) as count FROM reviews`, (err, row) => {
        if (row.count === 0) {
            const demoReviewPhotos = ['review-1.jpg', 'review-2.jpg', 'review-3.jpg', 'review-4.jpg'];
            demoReviewPhotos.forEach(photo => {
                const photoPath = path.join(reviewsPhotoDir, photo);
                if (!fs.existsSync(photoPath)) fs.writeFileSync(photoPath, '');
            });
            const reviewsData = [
                ['Анна Сергеева (дизайнер)', 'Дружный коллектив, интересные проекты, отличный соцпакет!', '/uploads/reviews/review-1.jpg'],
                ['Максим Орлов (монтажер)', 'Современное оборудование, карьерный рост. Очень доволен.', '/uploads/reviews/review-2.jpg'],
                ['Елена Воробьева (менеджер)', 'Гибкий график, поддержка руководства, достойная зарплата.', '/uploads/reviews/review-3.jpg'],
                ['Игорь Ким (редактор)', 'Креативная атмосфера, всегда новые вызовы. Рекомендую!', '/uploads/reviews/review-4.jpg']
            ];
            const stmt = db.prepare(`INSERT INTO reviews (author, text, photo) VALUES (?, ?, ?)`);
            reviewsData.forEach(r => stmt.run(r));
            stmt.finalize();
        }
    });
});

// API для сотрудников
app.get('/api/staff', (req, res) => {
    db.all(`SELECT * FROM staff`, (err, rows) => res.json(rows));
});
app.post('/api/staff', uploadPhoto.single('photo'), (req, res) => {
    const { name, position, description } = req.body;
    const photo = req.file ? `/uploads/staff/${req.file.filename}` : '';
    db.run(`INSERT INTO staff (name, position, description, photo) VALUES (?, ?, ?, ?)`, [name, position, description, photo], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});
app.put('/api/staff/:id', uploadPhoto.single('photo'), (req, res) => {
    const { name, position, description } = req.body;
    let photo = req.body.photo;
    if (req.file) photo = `/uploads/staff/${req.file.filename}`;
    db.run(`UPDATE staff SET name=?, position=?, description=?, photo=? WHERE id=?`, [name, position, description, photo, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
app.delete('/api/staff/:id', (req, res) => {
    db.run(`DELETE FROM staff WHERE id=?`, req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// API для вакансий (публичные)
app.get('/api/vacancies', (req, res) => {
    db.all(`SELECT * FROM vacancies WHERE is_active = 1`, (err, rows) => res.json(rows));
});

// API для отзывов (публичные)
app.get('/api/reviews', (req, res) => {
    db.all(`SELECT * FROM reviews`, (err, rows) => res.json(rows));
});

// Отправка заявки
app.post('/api/apply', uploadResume.single('resume'), (req, res) => {
    try {
        const { vacancy, fullName, phone, email, experience, hasExp, captcha } = req.body;
        
        if (captcha !== '5') return res.status(400).json({ error: 'Неверный ответ капчи' });
        if (!fullName || !phone || !email) return res.status(400).json({ error: 'Заполните все поля' });
        if (!/^[A-Za-zА-Яа-яёЁ\s\-]+$/.test(fullName)) return res.status(400).json({ error: 'ФИО только буквы' });
        
        let finalExperience = '';
        if (hasExp === 'yes') {
            finalExperience = (experience || '').trim();
            if (!finalExperience) return res.status(400).json({ error: 'Опишите опыт' });
        } else if (hasExp === 'no') {
            finalExperience = 'Нет опыта';
        } else {
            return res.status(400).json({ error: 'Укажите наличие опыта' });
        }
        
        const resumePath = req.file ? `/uploads/${req.file.filename}` : null;
        if (!resumePath) return res.status(400).json({ error: 'Прикрепите резюме' });
        
        db.run(`INSERT INTO applications (vacancy, fullName, phone, email, experience, resume_path) VALUES (?, ?, ?, ?, ?, ?)`,
            [vacancy, fullName, phone, email, finalExperience, resumePath],
            function(err) {
                if (err) {
                    console.error('DB error:', err);
                    return res.status(500).json({ error: 'Ошибка БД' });
                }
                if (isEmailConfigured()) {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
                    });
                    transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
                        subject: `Новый отклик: ${vacancy}`,
                        html: `<p>${fullName}, ${phone}, ${email}</p>`
                    }).catch(e => console.error('Email admin error:', e.message));
                    transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: email,
                        subject: 'PeKom - заявка принята',
                        html: `<p>Спасибо, ${fullName}. Мы свяжемся с вами.</p>`
                    }).catch(e => console.error('Email user error:', e.message));
                } else {
                    console.log('Почта не настроена, письма не отправлены');
                }
                res.json({ success: true });
            });
    } catch(e) {
        console.error('Ошибка при отправке:', e);
        res.status(500).json({ error: 'Внутренняя ошибка' });
    }
});

// Админ-панель API
function isAuth(req, res, next) { if (req.session.admin) next(); else res.status(401).json({ error: 'Unauthorized' }); }
app.post('/admin/login', (req, res) => {
    const { login, password } = req.body;
    db.get(`SELECT * FROM admin WHERE login = ?`, [login], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'Неверные данные' });
        if (bcrypt.compareSync(password, row.password_hash)) { req.session.admin = true; res.json({ success: true }); }
        else res.status(401).json({ error: 'Неверные данные' });
    });
});
app.post('/admin/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

// Заявки
app.get('/admin/applications', isAuth, (req, res) => db.all(`SELECT * FROM applications ORDER BY created_at DESC`, (err, rows) => res.json(rows)));
app.put('/admin/applications/:id', isAuth, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE applications SET status=? WHERE id=?`, [status, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
app.delete('/admin/applications/:id', isAuth, (req, res) => {
    db.run(`DELETE FROM applications WHERE id=?`, req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Сотрудники (для админки)
app.get('/admin/staff', isAuth, (req, res) => db.all(`SELECT * FROM staff`, (err, rows) => res.json(rows)));

// Отзывы (админские CRUD)
app.get('/admin/reviews', isAuth, (req, res) => db.all(`SELECT * FROM reviews`, (err, rows) => res.json(rows)));
app.post('/admin/reviews', isAuth, uploadReviewPhoto.single('photo'), (req, res) => {
    const { author, text } = req.body;
    const photo = req.file ? `/uploads/reviews/${req.file.filename}` : '';
    db.run(`INSERT INTO reviews (author, text, photo) VALUES (?, ?, ?)`, [author, text, photo], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});
app.put('/admin/reviews/:id', isAuth, uploadReviewPhoto.single('photo'), (req, res) => {
    const { author, text } = req.body;
    let photo = req.body.photo;
    if (req.file) photo = `/uploads/reviews/${req.file.filename}`;
    db.run(`UPDATE reviews SET author=?, text=?, photo=? WHERE id=?`, [author, text, photo, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
app.delete('/admin/reviews/:id', isAuth, (req, res) => {
    db.run(`DELETE FROM reviews WHERE id=?`, req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Глобальные обработчики ошибок
process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection:', reason); });

app.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));