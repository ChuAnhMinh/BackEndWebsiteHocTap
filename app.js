const express = require("express");
const jwt = require('jsonwebtoken');
const pgp = require("pg-promise")(/* options */);
const db = pgp("postgres://postgres:Minh0705@127.0.0.1:5432/online_learning");
const app = express();
const port = 3000;

app.use(express.json());

const secretKey = 'websitehoctap';



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
            const token = jwt.sign(data, secretKey, { expiresIn: '1h' });
            res.send({ success: true, token });
        } else {
            res.send({ success: false, message: "Tai khoan ko ton tai" });
        }
    } catch (err) {
        console.log(err);
    }
});

app.post("/signup", async (req, res) => {
    console.log(req.body);
    const { username, email, password } = req.body;
    try {
        const data = await db.oneOrNone(
            "SELECT * FROM appuser WHERE username = $1",
            [username]
        );
        if (data?.username) {
            res.send({success: false, message: "Tai khoan da ton tai" });
        } else {
            const result = await db.one('SELECT MAX(user_id) AS max_id FROM appuser');
            console.log(result);
            const userCreate = await db.one(
                'INSERT INTO appuser(user_id, username, email, password) VALUES($1, $2, $3, $4) RETURNING *',
                [result.max_id + 1, username, email, password]
            );
            res.send({success: true, message: "Tao tai khoan thanh cong"});
        }
    } catch (err) {
        console.log(err);
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
