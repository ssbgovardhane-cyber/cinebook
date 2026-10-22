const express = require("express");
const helmet = require("helmet");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";
const db = new Database(process.env.DB_FILE || path.join(__dirname, "cinebook.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS movies (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, language TEXT NOT NULL,
 genre TEXT NOT NULL, rating TEXT DEFAULT 'U/A', duration TEXT NOT NULL,
 description TEXT NOT NULL, poster TEXT NOT NULL, featured INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS theatres (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, area TEXT NOT NULL, city TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shows (
 id INTEGER PRIMARY KEY AUTOINCREMENT, movie_id INTEGER NOT NULL REFERENCES movies(id),
 theatre_id INTEGER NOT NULL REFERENCES theatres(id), show_date TEXT NOT NULL,
 show_time TEXT NOT NULL, price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, email TEXT NOT NULL,
 show_id INTEGER NOT NULL REFERENCES shows(id), seats TEXT NOT NULL,
 total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'CONFIRMED',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS booked_seats (
 show_id INTEGER NOT NULL REFERENCES shows(id), seat TEXT NOT NULL,
 booking_id TEXT NOT NULL REFERENCES bookings(id), PRIMARY KEY(show_id, seat)
);
`);

const movieCount = db.prepare("SELECT COUNT(*) n FROM movies").get().n;
if (!movieCount) {
  const movies = [
    ["The Last Horizon","Hindi","Action / Drama","U/A","2h 18m","An ex-soldier races against time to protect a city from a mysterious threat.","https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=700",1],
    ["Midnight in Mumbai","Hindi","Thriller","U/A","2h 06m","One night. Three strangers. A secret that changes everything.","https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=700",1],
    ["Little Big Dreams","Hindi","Family","U","1h 52m","A warm-hearted family story about courage, friendship and second chances.","https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=700",0],
    ["Galactic Run","English","Sci-Fi / Adventure","U/A","2h 24m","A crew of unlikely heroes takes on a mission beyond the stars.","https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=700",1],
    ["The Silent Witness","Marathi","Mystery","U/A","1h 58m","A small-town investigator uncovers the truth behind an impossible case.","https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=700",0],
    ["Monsoon Melody","Hindi","Romance","U","2h 10m","Two musicians find love and their own voices during the monsoon.","https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=700",0]
  ];
  const insert = db.prepare("INSERT INTO movies(title,language,genre,rating,duration,description,poster,featured) VALUES(?,?,?,?,?,?,?,?)");
  const tx = db.transaction(rows => rows.forEach(row => insert.run(...row)));
  tx(movies);
}
if (db.prepare("SELECT COUNT(*) n FROM theatres").get().n === 0) {
  const ins = db.prepare("INSERT INTO theatres(name,area,city) VALUES(?,?,?)");
  [
    ["CineMax Central","Sitabuldi","Nagpur"],["PVR Eternity","Eternity Mall","Nagpur"],
    ["MovieSquare","Wardha Road","Nagpur"],["Star Screens","Dharampeth","Nagpur"]
  ].forEach(x => ins.run(...x));
}
if (db.prepare("SELECT COUNT(*) n FROM shows").get().n === 0) {
  const today = new Date();
  const dates = [0,1,2].map(offset => {
    const d = new Date(today); d.setDate(d.getDate()+offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });
  const movies = db.prepare("SELECT id FROM movies").all();
  const theatres = db.prepare("SELECT id FROM theatres").all();
  const ins = db.prepare("INSERT INTO shows(movie_id,theatre_id,show_date,show_time,price) VALUES(?,?,?,?,?)");
  for (const date of dates) for (const movie of movies) for (const theatre of theatres) {
    for (const time of ["10:30","13:45","17:15","20:30"]) ins.run(movie.id,theatre.id,date,time,180 + (time === "20:30" ? 40 : 0));
  }
}

function requireAdmin(req, res, next) {
  if (req.get("x-admin-key") !== ADMIN_KEY) return res.status(401).json({error:"Admin key is incorrect."});
  next();
}
function seatsForShow(showId) {
  return db.prepare("SELECT seat FROM booked_seats WHERE show_id=?").all(showId).map(x => x.seat);
}

app.get("/api/movies", (req,res) => {
  const { q = "", language = "" } = req.query;
  const rows = db.prepare(`SELECT * FROM movies WHERE (title LIKE ? OR genre LIKE ?) AND (?='' OR language=?) ORDER BY featured DESC,title`)
    .all(`%${q}%`,`%${q}%`,language,language);
  res.json(rows);
});
app.get("/api/movies/:id", (req,res) => {
  const movie = db.prepare("SELECT * FROM movies WHERE id=?").get(req.params.id);
  if (!movie) return res.status(404).json({error:"Movie not found"});
  res.json(movie);
});
app.get("/api/shows", (req,res) => {
  const { movieId, date, city = "Nagpur" } = req.query;
  let sql = `SELECT s.*, t.name theatre_name,t.area,t.city,m.title movie_title
    FROM shows s JOIN theatres t ON t.id=s.theatre_id JOIN movies m ON m.id=s.movie_id WHERE t.city=?`;
  const params = [city];
  if (movieId) { sql += " AND s.movie_id=?"; params.push(movieId); }
  if (date) { sql += " AND s.show_date=?"; params.push(date); }
  sql += " ORDER BY s.show_date,s.show_time,t.name";
  res.json(db.prepare(sql).all(...params));
});
app.get("/api/shows/:id/seats", (req,res) => {
  const show = db.prepare("SELECT s.*,m.title movie_title,t.name theatre_name FROM shows s JOIN movies m ON m.id=s.movie_id JOIN theatres t ON t.id=s.theatre_id WHERE s.id=?").get(req.params.id);
  if (!show) return res.status(404).json({error:"Show not found"});
  res.json({show, booked:seatsForShow(show.id), rows:["A","B","C","D","E","F","G","H"], seatsPerRow:10});
});
app.post("/api/bookings", (req,res) => {
  const { customerName, email, showId, seats } = req.body || {};
  if (!customerName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") || !Number.isInteger(Number(showId)) || !Array.isArray(seats) || !seats.length || seats.length > 8)
    return res.status(400).json({error:"Enter your name, valid email, show and 1–8 seats."});
  const uniqueSeats = [...new Set(seats)];
  const validSeat = /^[A-H](10|[1-9])$/;
  if (uniqueSeats.length !== seats.length || uniqueSeats.some(s => !validSeat.test(s)))
    return res.status(400).json({error:"One or more seat selections are invalid."});
  const show = db.prepare("SELECT * FROM shows WHERE id=?").get(Number(showId));
  if (!show) return res.status(404).json({error:"Show not found"});
  const bookingId = "CB-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const total = show.price * uniqueSeats.length;
  try {
    const reserve = db.transaction(() => {
      const insertBooking = db.prepare("INSERT INTO bookings(id,customer_name,email,show_id,seats,total,status) VALUES(?,?,?,?,?,?,?)");
      insertBooking.run(bookingId, customerName.trim(), email.trim(), show.id, JSON.stringify(uniqueSeats), total, "CONFIRMED");
      const insertSeat = db.prepare("INSERT INTO booked_seats(show_id,seat,booking_id) VALUES(?,?,?)");
      uniqueSeats.forEach(seat => insertSeat.run(show.id, seat, bookingId));
    });
    reserve();
  } catch (e) {
    if (String(e.code).includes("CONSTRAINT")) return res.status(409).json({error:"A selected seat was just booked. Please choose another seat."});
    console.error(e); return res.status(500).json({error:"Could not complete booking."});
  }
  res.status(201).json({bookingId, customerName:customerName.trim(), email:email.trim(), showId:show.id, seats:uniqueSeats, total, status:"CONFIRMED", paymentMode:"DEMO — no money charged"});
});
app.get("/api/bookings/:id", (req,res) => {
  const b = db.prepare(`SELECT b.*,s.show_date,s.show_time,m.title movie_title,t.name theatre_name,t.area
    FROM bookings b JOIN shows s ON s.id=b.show_id JOIN movies m ON m.id=s.movie_id JOIN theatres t ON t.id=s.theatre_id WHERE b.id=?`).get(req.params.id);
  if (!b) return res.status(404).json({error:"Booking not found"});
  res.json({...b,seats:JSON.parse(b.seats)});
});
app.get("/api/admin/summary", requireAdmin, (req,res) => {
  res.json({
    movies:db.prepare("SELECT COUNT(*) n FROM movies").get().n,
    shows:db.prepare("SELECT COUNT(*) n FROM shows").get().n,
    bookings:db.prepare("SELECT COUNT(*) n FROM bookings").get().n,
    revenue:db.prepare("SELECT COALESCE(SUM(total),0) n FROM bookings").get().n,
    recent:db.prepare(`SELECT b.id,b.customer_name,b.email,b.seats,b.total,b.created_at,m.title movie_title
      FROM bookings b JOIN shows s ON s.id=b.show_id JOIN movies m ON m.id=s.movie_id ORDER BY b.created_at DESC LIMIT 20`).all().map(b=>({...b,seats:JSON.parse(b.seats)}))
  });
});
app.post("/api/admin/movies", requireAdmin, (req,res) => {
  const {title,language,genre,rating="U/A",duration,description,poster} = req.body || {};
  if (![title,language,genre,duration,description,poster].every(v=>typeof v==="string" && v.trim())) return res.status(400).json({error:"All movie fields are required."});
  const info = db.prepare("INSERT INTO movies(title,language,genre,rating,duration,description,poster) VALUES(?,?,?,?,?,?,?)").run(title.trim(),language.trim(),genre.trim(),rating,duration.trim(),description.trim(),poster.trim());
  res.status(201).json({id:info.lastInsertRowid});
});
app.post("/api/admin/shows", requireAdmin, (req,res) => {
  const {movieId,theatreId,date,time,price} = req.body || {};
  if (!movieId || !theatreId || !/^\d{4}-\d{2}-\d{2}$/.test(date||"") || !/^\d{2}:\d{2}$/.test(time||"") || !Number.isInteger(Number(price)) || Number(price)<1)
    return res.status(400).json({error:"Movie, theatre, date, time and valid price are required."});
  const info = db.prepare("INSERT INTO shows(movie_id,theatre_id,show_date,show_time,price) VALUES(?,?,?,?,?)").run(movieId,theatreId,date,time,price);
  res.status(201).json({id:info.lastInsertRowid});
});
app.get("/api/admin/theatres", requireAdmin, (req,res) => res.json(db.prepare("SELECT * FROM theatres ORDER BY city,name").all()));
app.get("/api/admin/movies", requireAdmin, (req,res) => res.json(db.prepare("SELECT id,title FROM movies ORDER BY title").all()));
app.use("/api", (req,res) => res.status(404).json({error:"API endpoint not found"}));
app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT, () => console.log(`CineBook running at http://localhost:${PORT}`));
