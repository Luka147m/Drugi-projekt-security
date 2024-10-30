import express, { Request, Response } from 'express';
import path from 'path';
import https from 'https';
import fs from 'fs';
import sanitizeHtml, { IOptions, DisallowedTagsModes } from 'sanitize-html';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import session from 'express-session';
import cookieParser from 'cookie-parser';

dotenv.config();
const app = express();

const externalUrl = process.env.EXTERNAL_URL || null;
const port = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 8000;
const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://prvi-projekt-auth-web.onrender.com'
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
const MAX_COMMENT_LENGTH = 200;
const MAX_COMMENTS = 10;
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

app.get('/kontrolaPristupa', (req: Request, res: Response) => {
    res.render('access', { allowBrokenAccessControl });
})

app.post('/addComment', (req: Request, res: Response) => {
    let comment: string = req.body.comment

    if (comment.length > MAX_COMMENT_LENGTH) {
        comment = comment.slice(0, MAX_COMMENT_LENGTH);
    }

    if (xssProtection) {
        comment = sanitizeHtml(comment, sanitizeOptions)
    }

    if (comments.length >= MAX_COMMENTS) {
        comments.shift();
    }

    comments.push(comment)
    res.redirect('/pohranjeniXSS')
});

app.post('/toggleXSSProtection', (req: Request, res: Response) => {
    xssProtection = !xssProtection;
    res.status(200).send({ xssProtection })
});

app.post('/deleteComments', (req: Request, res: Response) => {
    comments = [];
    res.status(200).send()
});

app.get('/login', (req: Request, res: Response) => {
    res.render('login');
})

app.post('/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        req.session.user = { username, role: users[username].role };

        res.cookie('userRole', users[username].role, {
            maxAge: 900000,
            httpOnly: true,
            secure: true
        });

        return res.redirect('/dashboard');
    }
    res.redirect('/');
});

app.get('/dashboard', (req: Request, res: Response) => {
    const user = req.session.user;
    const userRole = req.cookies.userRole;

    res.render('dashboard', { user, userRole });
});

let allowBrokenAccessControl = false;

app.post('/toggle-access-control', (req: Request, res: Response) => {
    allowBrokenAccessControl = !allowBrokenAccessControl;
    res.redirect('/dashboard');
});

app.get('/admin', (req: Request, res: Response) => {
    const user = req.session.user;
    const userRole = req.cookies.userRole;

    if (!allowBrokenAccessControl && (!user || user.role !== 'admin')) {
        res.status(403).send('Access denied: Unauthorized access.');
        return
    }
    res.send('Welcome to the admin page!');
});

app.post('/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.clearCookie('userRole');
        res.redirect('/');
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