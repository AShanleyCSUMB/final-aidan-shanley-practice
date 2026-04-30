import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Assumed columns:
// fe_comics_sites: site_id, site_name, site_url
// fe_comics: comic_id, site_id, title, comic_date, comic_url
// fe_comments: comment_id, comic_id, author, comment_date, comment
// If your SQL names differ, update the SELECT/INSERT fields below.

app.get("/", async (req, res) => {
  try {
    const sites = await query(`
      SELECT site_id, site_name, site_url
      FROM fe_comics_sites
      ORDER BY site_name
    `);

    const randomComicRows = await query(`
      SELECT c.comic_id, c.title, c.comic_date, c.comic_url,
             s.site_id, s.site_name
      FROM fe_comics c
      JOIN fe_comics_sites s ON c.site_id = s.site_id
      ORDER BY RAND()
      LIMIT 1
    `);

    const randomComic = randomComicRows[0] || null;

     res.render("index", { sites, randomComic });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading home page.");
  }
});

app.get("/addComic", async (req, res) => {
  try {
    const sites = await query(`
      SELECT site_id, site_name
      FROM fe_comics_sites
      ORDER BY site_name
    `);
    res.render("addComic", { sites, error: null, success: null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading add comic page.");
  }
});

app.post("/addComic", async (req, res) => {
  const { title, comic_date, comic_url, site_id } = req.body;

  try {
    const sites = await query(`
      SELECT site_id, site_name
      FROM fe_comics_sites
      ORDER BY site_name
    `);

    if (!title || !comic_date || !comic_url || !site_id) {
      return res.render("addComic", {
        sites,
        error: "All fields are required.",
        success: null
      });
    }

    await query(
      `INSERT INTO fe_comics (title, comic_date, comic_url, site_id)
       VALUES (?, ?, ?, ?)`,
      [title, comic_date, comic_url, site_id]
    );

    res.render("addComic", {
      sites,
      error: null,
      success: "Comic added successfully!"
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding comic.");
  }
});

app.get("/comic/:siteId", async (req, res) => {
  const { siteId } = req.params;

  try {
    const siteRows = await query(
      `SELECT site_id, site_name, site_url FROM fe_comics_sites WHERE site_id = ?`,
      [siteId]
    );

    if (!siteRows.length) {
      return res.status(404).send("Comic site not found.");
    }

    const comics = await query(
      `SELECT comic_id, title, comic_date, comic_url
       FROM fe_comics
       WHERE site_id = ?
       ORDER BY comic_date DESC, comic_id DESC`,
      [siteId]
    );

    res.render("comicPage", {
      site: siteRows[0],
      comics
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading comic page.");
  }
});

app.get("/addComment/:comicId", async (req, res) => {
  const { comicId } = req.params;

  try {
    const comicRows = await query(
      `SELECT c.comic_id, c.title, c.comic_date, c.comic_url, s.site_name
       FROM fe_comics c
       JOIN fe_comics_sites s ON c.site_id = s.site_id
       WHERE c.comic_id = ?`,
      [comicId]
    );

    if (!comicRows.length) {
      return res.status(404).send("Comic not found.");
    }

    res.render("addComment", {
      comic: comicRows[0],
      error: null,
      success: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading add comment page.");
  }
});

app.post("/addComment/:comicId", async (req, res) => {
  const { comicId } = req.params;
  const { author, comment } = req.body;

  try {
    const comicRows = await query(
      `SELECT c.comic_id, c.title, c.comic_date, c.comic_url, s.site_name
       FROM fe_comics c
       JOIN fe_comics_sites s ON c.site_id = s.site_id
       WHERE c.comic_id = ?`,
      [comicId]
    );

    if (!comicRows.length) {
      return res.status(404).send("Comic not found.");
    }

    if (!author || !comment) {
      return res.render("addComment", {
        comic: comicRows[0],
        error: "Author and comment are required.",
        success: null
      });
    }

    await query(
      `INSERT INTO fe_comments (comic_id, author, comment_date, comment)
       VALUES (?, ?, CURDATE(), ?)`,
      [comicId, author, comment]
    );

    res.render("addComment", {
      comic: comicRows[0],
      error: null,
      success: "Comment added successfully!"
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding comment.");
  }
});

// API: random comic without page reload
app.get("/api/random-comic", async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.comic_id, c.title, c.comic_date, c.comic_url,
             s.site_id, s.site_name
      FROM fe_comics c
      JOIN fe_comics_sites s ON c.site_id = s.site_id
      ORDER BY RAND()
      LIMIT 1
    `);

    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load random comic." });
  }
});

// API: comments for modal window
app.get("/api/comments/:comicId", async (req, res) => {
  const { comicId } = req.params;

  try {
    const comments = await query(
      `SELECT comment_id, author, comment_date, comment
       FROM fe_comments
       WHERE comic_id = ?
       ORDER BY comment_date DESC, comment_id DESC`,
      [comicId]
    );

    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load comments." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});