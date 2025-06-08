const express = require("express");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const pgp = require("pg-promise")(/* options */);
const db = pgp("postgres://postgres:Minh0705@127.0.0.1:5432/online_learning");
const app = express();
const port = 3000;

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

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    secure: false, // true for 465, false for other ports
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

// CRUD course

// create
app.post("/course", async (req, res) => {
    const { title, description, teacher_id } = req.body;
    if (!title || !description || !teacher_id)
        return res.send({
            message: "Khong du thong tin",
            success: false,
        });
    const course = await db.one(
        "INSERT INTO course(title, description, teacher_id) VALUES($1, $2, $3) RETURNING *",
        [title, description, teacher_id]
    );

    res.send({
        success: true,
        message: "Them moi thanh cong",
        data: course,
    });
});

// read
app.get("/course", async (req, res) => {
    const course = await db.any("SELECT * FROM course");

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
app.patch("/course/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    if (!title || !description)
        return res.send({
            message: "Khong du thong tin",
            success: false,
        });
    const updateCourse = await db.oneOrNone(
        "UPDATE course SET title = $1, description = $2 WHERE course_id = $3 RETURNING *",
        [title, description, id]
    );

    res.send({
        success: true,
        data: updateCourse,
    });
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

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
