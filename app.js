const express = require("express");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const pgp = require("pg-promise")(/* options */);
const cors = require('cors');
const db = pgp("postgres://postgres:Minh0705@127.0.0.1:5432/online_learning");
const app = express();
const port = 3000;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo folder nếu chưa có
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const videoPath = path.join(__dirname, 'uploads/videos');
if (!fs.existsSync(videoPath)) fs.mkdirSync(videoPath);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    },
});
const upload = multer({ storage });

const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/videos/');
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    },
});

const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: 2000 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.mp4' || ext === '.mov' || ext === '.avi' || ext === '.mkv') {
            cb(null, true);
        } else {
            cb(new Error('Chỉ cho phép định dạng video (.mp4, .mov, .avi, .mkv)'));
        }
    }
});

// Truy cập ảnh qua http://localhost:3000/uploads/filename.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use(express.json());

const secretKey = "websitehoctap";

app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.get("/", (req, res) => {
    res.send("Hello World");
});

app.post("/login", async (req, res) => {
    console.log(req.body);
    const { username, password } = req.body;
    if (!username || !password)
        res.send({
            success: false,
            message: "thieu field",
        });

    try {
        const data = await db.oneOrNone(
            "SELECT * FROM appuser WHERE username = $1 and password = $2",
            [username, password]
        );
        if (data?.username) {
            const token = jwt.sign(data, secretKey, { expiresIn: "1h" });
            res.send({ success: true, token, data: data });
        } else {
            res.send({ success: false, message: "Tai khoan ko ton tai" });
        }
    } catch (err) {
        console.log(err);
    }
});

app.post("/signup", async (req, res) => {
    console.log(req.body);
    const { username, email, password, role_id } = req.body;
    try {
        const data = await db.oneOrNone(
            "SELECT * FROM appuser WHERE username = $1",
            [username]
        );
        if (data?.username) {
            res.send({ success: false, message: "Tai khoan da ton tai" });
        } else {
            const result = await db.one(
                "SELECT MAX(user_id) AS max_id FROM appuser"
            );
            console.log(result);
            const userCreate = await db.one(
                "INSERT INTO appuser(user_id, username, email, password, role_id) VALUES($1, $2, $3, $4, $5) RETURNING *",
                [result.max_id + 1, username, email, password, role_id]
            );
            res.send({ success: true, message: "Tao tai khoan thanh cong" });
        }
    } catch (err) {
        console.log(err);
    }
});

const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    secure: false,
    auth: {
        user: "chuanhminh2004@gmail.com",
        pass: "lmfo uksk sjbi jkdh",
    },
});

// Wrap in an async IIFE so we can use await.
const sendEmail = async (email, title, text) => {
    const info = await transporter.sendMail({
        from: "admin",
        to: email,
        subject: title,
        text: text, // plain‑text body
    });

    console.log("Message sent:", info.messageId);
};

app.post("/forgot-password-request", async (req, res) => {
    const { email } = req.body;
    console.log(">>> [FORGOT-PASSWORD-REQUEST] req.body:", req.body);
    if (!email)
        return res.send({
            message: "Vui long nhap email",
            success: false,
        });
    sendEmail(
        email,
        "Quen mat khau",
        `Ban can truy cap link nay de quen mat khau:
        http://127.0.0.1:5500/forgot-password-confirm.html?email=${email}
        `
    );
    res.send({
        success: true,
    });
});

app.post("/forgot-password-update", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.send({
            message: "Email k co",
            success: false,
        });
    // doi mat khau DB
    const updatedUser = await db.oneOrNone(
        "UPDATE appuser SET password = $1 WHERE email = $2 RETURNING *",
        [password, email]
    );

    console.log(">>> [FORGOT-PASSWORD-UPDATE] updatedUser:", updatedUser);

    res.send({
        success: true,
        message: "Cap nhat mat khau thanh cong",
    });
});

app.get("/user/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const user = await db.oneOrNone("SELECT * FROM appuser WHERE user_id = $1", [id]);
        res.send({ success: true, data: user });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Không tìm thấy user!" });
    }
});

// CRUD course

// create
app.post("/course", upload.single('courseAvatar'), async (req, res) => {
    const { title, description, teacher_id } = req.body;
    const imgSrc = req.file ? `/uploads/${req.file.filename}` : '';

    if (!title || !description || !teacher_id)
        return res.send({
            message: "Khong du thong tin",
            success: false,
        });

    try {
        const course = await db.one(
            "INSERT INTO course(title, description, teacher_id, course_avatar) VALUES($1, $2, $3, $4) RETURNING *",
            [title, description, teacher_id, imgSrc]
        );

        res.send({
            success: true,
            message: "Them moi thanh cong",
            data: course,
        });
    } catch (error) {
        console.log(error);
        res.send({ success: false, message: "Lỗi tạo khóa học" });
    }
});


// read
app.get("/course", async (req, res) => {
    const { teacher_id } = req.query;

    if (!teacher_id) {
        return res.send({
            success: false,
            message: "Khong ro Giao vien",
        });
    }

    const course = await db.any(
        "SELECT * FROM course WHERE teacher_id = $1",
        [teacher_id]
    );

    res.send({
        success: true,
        data: course,
    });
});

// get detail
app.get("/course/:id", async (req, res) => {
    const { id } = req.params;
    const course = await db.oneOrNone(
        "SELECT * FROM course WHERE course_id = $1",
        [id]
    );

    res.send({
        success: true,
        data: course,
    });
});

// update
app.patch("/course/:id", upload.single('courseAvatar'), async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    const courseAvatar = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !description) {
        return res.send({ success: false, message: "Khong du thong tin" });
    }

    let query, values;
    if (courseAvatar) {
        query = `
            UPDATE course
            SET title = $1, description = $2, course_avatar = $3
            WHERE course_id = $4 RETURNING *`;
        values = [title, description, courseAvatar, id];
    } else {
        query = `
            UPDATE course
            SET title = $1, description = $2
            WHERE course_id = $3 RETURNING *`;
        values = [title, description, id];
    }

    try {
        const updated = await db.one(query, values);
        res.send({ success: true, data: updated });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Lỗi khi cập nhật khóa học" });
    }
});


// delete
app.delete("/course/:id", async (req, res) => {
    const { id } = req.params;
    const deletedCourse = await db.oneOrNone(
        "DELETE FROM course WHERE course_id = $1 RETURNING *",
        [id]
    );
    res.send({
        success: true,
        data: deletedCourse,
    });
});

//API about Student

//Lấy tất cả các course
app.get("/courses", async (req, res) => {
    console.log('>>> [GET /courses]');
    const courses = await db.any("SELECT * FROM course");
    res.send({
        success: true,
        data: courses,
    });
});

//Xử lý Course theo người dùng
app.get("/my-courses", async (req, res) => {
    const { email } = req.query;

    console.log(`>>> [GET /my-courses] email: ${email}`);

    if (!email) {
        return res.send({
            success: false,
            message: "Email ko co",
        });
    }

    const user = await db.oneOrNone("SELECT user_id FROM appuser WHERE email = $1", [email]);
    if (!user) {
        return res.send({
            success: false,
            message: "Nguoi dung ko ton tai",
        });
    }

    const enrollments = await db.any(
        "SELECT course_id FROM courseenrollment WHERE user_id = $1",
        [user.user_id]
    );

    const courseIds = enrollments.map(e => e.course_id);

    console.log(`>>> [GET /my-courses] user_id: ${user.user_id}, courses:`, courseIds);

    res.send({
        success: true,
        data: courseIds,
    });
});

// POST /book-course
app.post("/book-course", async (req, res) => {
    const { email, courseId } = req.body;

    console.log(`>>> [POST /book-course] email: ${email}, courseId: ${courseId}`);

    if (!email || !courseId) {
        return res.send({
            success: false,
            message: "Khong co Email hoac Course",
        });
    }

    const user = await db.oneOrNone("SELECT user_id FROM appuser WHERE email = $1", [email]);
    if (!user) {
        return res.send({
            success: false,
            message: "User ko ton tai",
        });
    }

    // Kiem tra neu da ghi danh roi
    const existing = await db.oneOrNone(
        "SELECT * FROM courseenrollment WHERE user_id = $1 AND course_id = $2",
        [user.user_id, courseId]
    );

    if (existing) {
        console.log(`>>> [POST /book-course] Already enrolled! user_id: ${user.user_id}, course_id: ${courseId}`);
        return res.send({
            success: false,
            message: "Da ghi danh roi",
        });
    }

    // Insert enrollment
    const enrollment = await db.one(
        "INSERT INTO courseenrollment(user_id, course_id) VALUES($1, $2) RETURNING *",
        [user.user_id, courseId]
    );

    console.log(`>>> [POST /book-course] Enrollment created:`, enrollment);

    res.send({
        success: true,
        message: "Ghi danh thanh cong",
        data: enrollment,
    });
});

// CREATE chapter
app.post("/chapter", async (req, res) => {
    const { title, course_id } = req.body;
    if (!title || !course_id)
        return res.send({ success: false, message: "Thiếu thông tin" });

    try {
        const chapter = await db.one(
            "INSERT INTO chapter(title, course_id) VALUES($1, $2) RETURNING *",
            [title, course_id]
        );
        res.send({ success: true, data: chapter });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Tạo chương thất bại" });
    }
});

app.get("/chapter", async (req, res) => {
    const { course_id } = req.query;

    if (!course_id) {
        return res.send({
            success: false,
            message: "Khong co course",
        });
    }

    const chapter = await db.any(
        "SELECT * FROM chapter WHERE course_id = $1",
        [course_id]
    );

    res.send({
        success: true,
        data: chapter,
    });
});

// GET chapters by course_id
app.get("/chapters/:course_id", async (req, res) => {
    const { course_id } = req.params;
    try {
        const chapters = await db.any(
            "SELECT * FROM chapter WHERE course_id = $1",
            [course_id]
        );
        res.send({ success: true, data: chapters });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Lấy chương thất bại" });
    }
});

// UPDATE chapter
app.patch("/chapter/:id", async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    try {
        const updated = await db.oneOrNone(
            "UPDATE chapter SET title = $1 WHERE chapter_id = $2 RETURNING *",
            [title, id]
        );
        res.send({ success: true, data: updated });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Cập nhật thất bại" });
    }
});

// DELETE chapter
app.delete("/chapter/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await db.oneOrNone(
            "DELETE FROM chapter WHERE chapter_id = $1 RETURNING *",
            [id]
        );
        res.send({ success: true, data: deleted });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Xoá thất bại" });
    }
});

// CREATE lesson
app.post("/lesson", async (req, res) => {
    const { title, content, chapter_id, video_url } = req.body;
    if (!title || !chapter_id)
        return res.send({ success: false, message: "Thiếu thông tin" });

    try {
        const lesson = await db.one(
            `INSERT INTO lesson(title, content, chapter_id, video_url)
             VALUES($1, $2, $3, $4) RETURNING *`,
            [title, content || '', chapter_id, video_url || null]
        );
        res.send({ success: true, data: lesson });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Tạo bài học thất bại" });
    }
});

// GET lessons by chapter_id
app.get("/lessons/:chapter_id", async (req, res) => {
    const { chapter_id } = req.params;
    try {
        const lessons = await db.any(
            "SELECT * FROM lesson WHERE chapter_id = $1",
            [chapter_id]
        );
        res.send({ success: true, data: lessons });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Lấy bài học thất bại" });
    }
});

// UPDATE lesson
app.patch("/lesson/:id", async (req, res) => {
    const { id } = req.params;
    const { title, content, video_url } = req.body;
    try {
        const updated = await db.oneOrNone(
            `UPDATE lesson SET title = $1, content = $2, video_url = $3
             WHERE lesson_id = $4 RETURNING *`,
            [title, content, video_url, id]
        );
        res.send({ success: true, data: updated });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Cập nhật bài học thất bại" });
    }
});

// DELETE lesson
app.delete("/lesson/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await db.oneOrNone(
            "DELETE FROM lesson WHERE lesson_id = $1 RETURNING *",
            [id]
        );
        res.send({ success: true, data: deleted });
    } catch (err) {
        console.log(err);
        res.send({ success: false, message: "Xoá bài học thất bại" });
    }
});

app.post("/upload-video/:lesson_id", uploadVideo.single("video"), async (req, res) => {
    const { lesson_id } = req.params;

    if (!req.file) {
        return res.send({ success: false, message: "Không có video nào được tải lên!" });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;

    try {
        const updated = await db.oneOrNone(
            "UPDATE lesson SET video_url = $1 WHERE lesson_id = $2 RETURNING *",
            [videoUrl, lesson_id]
        );

        if (!updated) {
            return res.send({ success: false, message: "Không tìm thấy bài học để cập nhật!" });
        }

        res.send({
            success: true,
            message: "Upload và cập nhật bài học thành công!",
            data: updated
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({ success: false, message: "Upload video thất bại" });
    }
});


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});