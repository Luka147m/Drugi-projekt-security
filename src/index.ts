import express, { Request, Response } from 'express';
import path from 'path';
import https from 'https';
import fs from 'fs';
import sanitizeHtml, { IOptions, DisallowedTagsModes } from 'sanitize-html';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import pool from './database';


dotenv.config();
const app = express();

const externalUrl = process.env.EXTERNAL_URL || null;
const port = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 8080;
const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://drugi-projekt-security.onrender.com/'
    : `https://localhost:${port}`;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../dist/public')));
app.set('views', path.join(__dirname, '../dist/views'));
app.set("view engine", "pug");

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SECRET ?? 'cookiemonsterislost',
    resave: false,
    saveUninitialized: true,
}));

let comments: string[] = [];
const MAX_COMMENT_LENGTH = 400;
let xssProtection: boolean = false;

const users: { [key: string]: { role: string; username: string; password: string } } = {
    user: { role: 'user', username: 'user', password: 'userpass' },
    admin: { role: 'admin', username: 'admin', password: 'adminpass' },
};

declare module 'express-session' {
    interface SessionData {
        user: {
            username: string;
            role: string;
        };
    }
}

const sanitizeOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape' as DisallowedTagsModes
};

app.get('/', (req: Request, res: Response) => {
    res.render('index');
})

app.get('/pohranjeniXSS', (req: Request, res: Response) => {
    res.render('xss', { comments, xssProtection });
})

app.get('/comments', async (req: Request, res: Response) => {
    const query = 'SELECT * FROM comments ORDER BY id DESC';
    try {
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Pogreška tijekom dohvaćanja komentara:', err);
        res.status(500).send('Server error');
    }
})

app.post('/addComment', async (req: Request, res: Response) => {
    let comment: string = req.body.comment

    if (comment.length > MAX_COMMENT_LENGTH) {
        comment = comment.slice(0, MAX_COMMENT_LENGTH);
    }

    if (xssProtection) {
        comment = sanitizeHtml(comment, sanitizeOptions)
    }

    const query = 'INSERT INTO comments (comment_text) VALUES ($1)';
    try {
        const result = await pool.query(query, [comment]);
        res.status(201).json({ success: true, comment: result.rows[0] });
    } catch (err) {
        console.error('Pogreška tijekom unosa komentara:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.delete('/comments/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query('DELETE FROM comments WHERE id = $1', [id]);
        if (result.rowCount! > 0) {
            res.status(200).send('Komentar uspješno obrisan');
        } else {
            res.status(404).send('Komentar nije pronađen');
        }
    } catch (error) {
        console.error('Pogreška tijekom brisanja komentara:', error);
        res.status(500).send('Server error');
    }
});

app.delete('/comments', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE comments;');
        res.status(200).send('Komentari uspješno obrisani');
    } catch (error) {
        console.error('Pogreška tijekom brisanja komentara:', error);
        res.status(500).send('Server error');
    }
});

app.post('/toggleXSSProtection', (req: Request, res: Response) => {
    xssProtection = !xssProtection;
    res.status(200).send({ xssProtection })
});

app.get('/kontrolaPristupa', (req: Request, res: Response) => {
    const userInfo = req.cookies.userInfo ? JSON.parse(req.cookies.userInfo) : null;
    res.render('access', { brokenAccessProtection, userInfo });
})

app.get('/login', (req: Request, res: Response) => {
    res.render('login');
})

app.post('/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        req.session.user = { username, role: users[username].role };

        res.cookie('userInfo', JSON.stringify({ username, role: users[username].role }), {
            maxAge: 900000,
            httpOnly: true,
            secure: true
        });

        return res.redirect('/kontrolaPristupa');
    }
    return res.render('login', { error: 'Neispravan username ili šifra' });
});

app.get('/dashboard', (req: Request, res: Response) => {
    const user = req.session.user;
    const userRole = req.cookies.userRole;

    res.render('dashboard', { user, userRole });
});

let brokenAccessProtection = false;

app.post('/toggleAccessControl', (req: Request, res: Response) => {
    brokenAccessProtection = !brokenAccessProtection;
    res.status(200).send({ brokenAccessProtection })
});

app.get('/admin', (req: Request, res: Response) => {
    const user = req.session.user;
    const userRole = req.cookies.userRole;

    if (!brokenAccessProtection && (!user || user.role !== 'admin')) {
        res.status(403).send('Access denied: Unauthorized access.');
        return
    }
    res.send('Welcome to the admin page!');
});

app.post('/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Pogreška tijekom odjave.');
        }
        res.clearCookie('userInfo');
        res.status(200).send('Odjava uspješna.');
    });
});


if (externalUrl) {
    const hostname = '0.0.0.0';
    app.listen(port, hostname, () => {
        console.log(`Server running locally at http://${hostname}:${port}/`);
        console.log(`Also available from outside via ${externalUrl}`);
    });
} else {
    https.createServer({
        key: fs.readFileSync('server.key'),
        cert: fs.readFileSync('server.cert')
    }, app)
        .listen(port, function () {
            console.log(`Server running locally at https://localhost:${port}/`);
        });
}