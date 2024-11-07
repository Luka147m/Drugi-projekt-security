import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';
import pool from './database';
import { auth, requiresAuth } from 'express-openid-connect';


dotenv.config();
const app = express();

const externalUrl = process.env.EXTERNAL_URL || null;
const port = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 8080;
const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://drugi-projekt-security.onrender.com'
    : `https://localhost:${port}`;

const config = {
    authRequired: false,
    idpLogout: true,
    secret: process.env.SECRET,
    baseURL: baseUrl,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.AUTH0_DOMAIN,
    clientSecret: process.env.CLIENT_SECRET,
    authorizationParams: {
        response_type: 'code',
        scope: 'openid profile email',
    },
    routes: {
        login: false as false,
        // callback: false as false,
        postLogoutRedirect: '/kontrolaPristupa',
    },
};

app.use(auth(config));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../dist/public')));
app.set('views', path.join(__dirname, '../dist/views'));
app.set("view engine", "pug");

const MAX_COMMENT_LENGTH = 400; // Da ne zauzima puno mjesta u db
let xssProtection: boolean = true;
let brokenAccessProtection: boolean = true;

declare module 'express-openid-connect' {
    interface AccessToken {
        'app-roles/roles'?: string[];
    }
}

app.get('/', (req: Request, res: Response) => {
    res.render('index');
})

app.get('/pohranjeniXSS', (req: Request, res: Response) => {
    res.render('xss', { xssProtection });
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

function sanitizeHTML(str: string) {
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

app.post('/addComment', async (req: Request, res: Response) => {
    let comment: string = req.body.comment

    if (comment.length > MAX_COMMENT_LENGTH) {
        comment = comment.slice(0, MAX_COMMENT_LENGTH);
    }

    if (xssProtection) {
        comment = sanitizeHTML(comment)
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
    const user = req.oidc.user;
    const roles = req.oidc.user?.['app-roles/roles'] ?? [];
    if (roles.length < 1) {
        roles.push("Nema uloga")
    }
    const roles_string = roles.join(", ")
    res.render('access', { brokenAccessProtection, user, roles_string });
})

app.post('/toggleAccessControl', (req: Request, res: Response) => {
    brokenAccessProtection = !brokenAccessProtection;
    res.status(200).send({ brokenAccessProtection })
});

app.get('/dashboard/user', requiresAuth(), (req: Request, res: Response) => {
    const user = req.oidc.user;
    const roles = req.oidc.user?.['app-roles/roles'];
    if (roles.length < 1) {
        roles.push("Nema uloga")
    }
    const roles_string = roles.join(", ")

    if (roles && roles.includes('admin')) {
        res.redirect('/dashboard/admin')
    } else {
        res.render('user', { user, brokenAccessProtection, roles_string })
    }

});

app.get('/dashboard/admin', requiresAuth(), (req: Request, res: Response) => {
    const user = req.oidc.user;
    const roles = req.oidc.user?.['app-roles/roles'];
    if (roles.length < 1) {
        roles.push("Nema uloga")
    }
    const roles_string = roles.join(", ");

    if (brokenAccessProtection) {
        if (roles && roles.includes('admin')) {
            res.render('admin', { user, brokenAccessProtection, roles_string })
        } else {
            res.status(403).send("Pristup odbijen: nemate pravo pristupa stranici /dashboard/admin. Trebate imati ulogu administratora da bi mogli pristupiti ovoj stranici");
        }
    } else {
        res.render('admin', { user, brokenAccessProtection, roles_string })
    }

});

app.get('/login', (req, res) =>
    res.oidc.login({
        returnTo: '/kontrolaPristupa',
        authorizationParams: {
            redirect_uri: baseUrl + '/callback',
        },
    })
);

// app.get('/callback', (req, res) =>
//     res.oidc.callback({
//         redirectUri: baseUrl + '/callback',
//     })
// );

// app.post('/callback', express.urlencoded({ extended: false }), (req, res) =>
//     res.oidc.callback({
//         redirectUri: baseUrl + '/callback',
//     })
// );


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