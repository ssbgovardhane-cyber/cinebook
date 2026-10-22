const $ = s => document.querySelector(s);
const state = { movies:[], selectedMovie:null, selectedDate:null, selectedShow:null, booked:[], selectedSeats:[], adminKey:"" };
const money = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url, options={}) {
  const res = await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.remove("hidden");setTimeout(()=>el.classList.add("hidden"),3200)}
function openModal(html){$("#modal-content").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
$("#modal-close").addEventListener("click",closeModal);
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

async function loadMovies(){
  const q=$("#search").value.trim(), language=$("#language").value;
  try{
    state.movies=await api(`/api/movies?q=${encodeURIComponent(q)}&language=${encodeURIComponent(language)}`);
    renderMovies();
  }catch(e){$("#movie-grid").innerHTML=`<div class="empty">${escapeHtml(e.message)}. Please refresh the page.</div>`}
}
function renderMovies(){
  const grid=$("#movie-grid");
  if(!state.movies.length){grid.innerHTML='<div class="empty">No movies match your search. Try another title or language.</div>';return}
  grid.innerHTML=state.movies.map(m=>`<article class="movie-card" data-movie="${m.id}">
    <div class="poster-wrap"><img loading="lazy" src="${escapeHtml(m.poster)}" alt="${escapeHtml(m.title)} poster" onerror="this.style.display='none'"><span class="rating-pill">★ ${escapeHtml(m.rating)}</span></div>
    <div class="movie-info"><h3 title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</h3><p>${escapeHtml(m.language)} · ${escapeHtml(m.genre)}</p><button class="book-small" data-book="${m.id}">Book tickets →</button></div></article>`).join("");
  grid.querySelectorAll("[data-book]").forEach(b=>b.addEventListener("click",()=>openMovie(Number(b.dataset.book))));
  grid.querySelectorAll(".movie-card").forEach(card=>card.addEventListener("click",e=>{if(!e.target.closest("button"))openMovie(Number(card.dataset.movie))}));
}
let searchTimer;
$("#search").addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadMovies,180)});
$("#language").addEventListener("change",loadMovies);
$("#city").addEventListener("change",()=>toast("This MVP currently has sample theatres in Nagpur."));

function dateChoices(){
  const list=[];const now=new Date();
  for(let i=0;i<3;i++){const d=new Date(now);d.setDate(d.getDate()+i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;list.push({iso,label:i===0?"Today":i===1?"Tomorrow":d.toLocaleDateString("en-IN",{weekday:"short"}),sub:d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})})}
  return list;
}
async function openMovie(id){
  const movie=state.movies.find(m=>m.id===id)||await api(`/api/movies/${id}`).catch(()=>null);
  if(!movie)return toast("Movie details could not be loaded.");
  state.selectedMovie=movie;state.selectedDate=dateChoices()[0].iso;
  openModal(`<div class="eyebrow muted">NOW SHOWING</div><h2>${escapeHtml(movie.title)}</h2><p class="modal-sub">${escapeHtml(movie.language)} · ${escapeHtml(movie.genre)} · ${escapeHtml(movie.duration)} · ${escapeHtml(movie.rating)}<br>${escapeHtml(movie.description)}</p><div class="date-row">${dateChoices().map(d=>`<button class="chip ${d.iso===state.selectedDate?"active":""}" data-date="${d.iso}">${d.label}<br><small>${d.sub}</small></button>`).join("")}</div><div id="show-list"><div class="loading">Finding showtimes…</div></div>`);
  $("#modal-content").querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",()=>{state.selectedDate=b.dataset.date;$("#modal-content").querySelectorAll("[data-date]").forEach(x=>x.classList.toggle("active",x===b));loadShows()}));
  await loadShows();
}
async function loadShows(){
  const el=$("#show-list");if(!el)return;
  el.innerHTML='<div class="loading">Finding showtimes…</div>';
  try{
    const shows=await api(`/api/shows?movieId=${state.selectedMovie.id}&date=${state.selectedDate}&city=${encodeURIComponent($("#city").value)}`);
    if(!shows.length){el.innerHTML='<div class="empty">No showtimes available for this date.</div>';return}
    const groups={};shows.forEach(s=>(groups[s.theatre_name]??={area:s.area,shows:[]}).shows.push(s));
    el.innerHTML=Object.entries(groups).map(([name,g])=>`<div class="theatre-group"><h4>${escapeHtml(name)}</h4><p>📍 ${escapeHtml(g.area)} · M-Ticket</p><div class="show-row">${g.shows.map(s=>`<button class="chip" data-show="${s.id}">${s.show_time}<br><small>${money(s.price)}</small></button>`).join("")}</div></div>`).join("");
    el.querySelectorAll("[data-show]").forEach(b=>b.addEventListener("click",()=>openSeats(Number(b.dataset.show))));
  }catch(e){el.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function openSeats(showId){
  state.selectedShow=showId;state.selectedSeats=[];
  try{
    const data=await api(`/api/shows/${showId}/seats`);state.booked=data.booked;
    const s=data.show;
    openModal(`<div class="eyebrow muted">SELECT YOUR SEATS</div><h2>${escapeHtml(s.movie_title)}</h2><p class="modal-sub">${escapeHtml(s.theatre_name)} · ${escapeHtml(s.show_date)} · ${escapeHtml(s.show_time)}</p>
      <div class="seat-legend"><span><i class="seat-dot"></i> Available</span><span><i class="seat-dot selected"></i> Selected</span><span><i class="seat-dot booked"></i> Booked</span></div>
      <div class="screen"></div><div class="screen-label">SCREEN THIS WAY</div><div class="seat-map">${data.rows.map(row=>`<div class="seat-row"><span class="row-label">${row}</span>${Array.from({length:data.seatsPerRow},(_,i)=>{const seat=row+(i+1);const booked=state.booked.includes(seat);return `<button class="seat ${booked?"booked":""}" data-seat="${seat}" ${booked?"disabled":""} aria-label="Seat ${seat}">${i+1}</button>`}).join("")}</div>`).join("")}</div>
      <div class="checkout-bar"><div><small class="modal-sub">Selected seats</small><div id="seat-summary">None</div><strong id="seat-total">${money(0)}</strong></div><button id="continue-checkout" class="full-button" disabled>Continue →</button></div>`);
    $("#modal-content").querySelectorAll("[data-seat]").forEach(b=>b.addEventListener("click",()=>toggleSeat(b.dataset.seat,b)));
    $("#continue-checkout").addEventListener("click",checkout);
  }catch(e){toast(e.message)}
}
function toggleSeat(seat,button){
  if(state.selectedSeats.includes(seat)){state.selectedSeats=state.selectedSeats.filter(s=>s!==seat);button.classList.remove("selected")}
  else if(state.selectedSeats.length>=8){toast("You can book up to 8 seats at a time.");return}
  else{state.selectedSeats.push(seat);button.classList.add("selected")}
  state.selectedSeats.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  $("#seat-summary").textContent=state.selectedSeats.join(", ")||"None";
  $("#seat-total").textContent=money(state.selectedSeats.length*currentPrice());
  $("#continue-checkout").disabled=!state.selectedSeats.length;
}
function currentPrice(){return Number(document.querySelector("#seat-total")?.dataset.price||0)||state._showPrice||0}
async function checkout(){
  try{
    const data=await api(`/api/shows/${state.selectedShow}/seats`);state._showPrice=data.show.price;
    openModal(`<div class="eyebrow muted">ALMOST THERE</div><h2>Your movie night</h2><p class="modal-sub">${escapeHtml(data.show.movie_title)} · ${escapeHtml(data.show.theatre_name)} · ${escapeHtml(data.show.show_time)}</p><div class="notice">Demo checkout only: this prototype does not charge money. Add and verify a payment gateway before accepting real customer payments.</div>
    <form id="booking-form"><div class="form-grid"><div class="form-field"><label for="customerName">Full name</label><input id="customerName" name="customerName" required maxlength="100" placeholder="Your name"></div><div class="form-field"><label for="email">Email address</label><input id="email" name="email" type="email" required maxlength="200" placeholder="you@example.com"></div><div class="form-field full"><label>Seats selected</label><input value="${escapeHtml(state.selectedSeats.join(", "))}" readonly><small class="modal-sub">${state.selectedSeats.length} ticket(s) · ${money(data.show.price)} per ticket</small></div></div><div class="checkout-bar"><div><small class="modal-sub">Total (demo)</small><strong>${money(data.show.price*state.selectedSeats.length)}</strong></div><button class="full-button" type="submit">Confirm demo booking</button></div></form>`);
    $("#booking-form").addEventListener("submit",submitBooking);
  }catch(e){toast(e.message)}
}
async function submitBooking(e){
  e.preventDefault();const button=e.currentTarget.querySelector("button");button.disabled=true;button.textContent="Confirming…";
  const form=new FormData(e.currentTarget);
  try{
    const booking=await api("/api/bookings",{method:"POST",body:JSON.stringify({customerName:form.get("customerName"),email:form.get("email"),showId:state.selectedShow,seats:state.selectedSeats})});
    showTicket(booking);
  }catch(err){toast(err.message);button.disabled=false;button.textContent="Confirm demo booking"}
}
function showTicket(b){
  openModal(`<div class="eyebrow muted">BOOKING CONFIRMED</div><h2>It's movie time! 🎉</h2><p class="modal-sub">Your demo booking has been saved in the local database.</p><div class="ticket-confirm"><h3>CINEBOOK</h3><p>Movie ticket · ${escapeHtml(b.bookingId)}</p><div class="ticket-details"><div><small>BOOKING ID</small><strong>${escapeHtml(b.bookingId)}</strong></div><div><small>SEATS</small><strong>${escapeHtml(b.seats.join(", "))}</strong></div><div><small>BOOKED BY</small><strong>${escapeHtml(b.customerName)}</strong></div><div><small>TOTAL</small><strong>${money(b.total)}</strong></div></div><div class="qr-box" aria-label="Decorative QR-style placeholder"></div><p style="text-align:center;font-size:10px">Demo ticket · QR is illustrative, not scannable</p></div><div class="notice">No payment was collected. This is a prototype ticket and is not valid for entry to a real cinema.</div><button class="full-button" style="width:100%" id="done">Back to movies</button>`);
  $("#done").addEventListener("click",()=>{closeModal();loadMovies()});
}
$("#admin-open").addEventListener("click",adminLogin);
function adminLogin(){
  openModal(`<div class="eyebrow muted">MANAGEMENT</div><h2>Admin dashboard</h2><p class="modal-sub">Enter your server admin key to view bookings and summary.</p><form id="admin-form"><div class="form-field" style="margin:20px 0"><label for="adminKey">Admin key</label><input id="adminKey" type="password" required placeholder="Set ADMIN_KEY on your server"></div><button class="full-button" type="submit">Open dashboard</button></form><p class="modal-sub">Default development key: <strong>change-this-admin-key</strong>. Set a secure ADMIN_KEY before deployment.</p>`);
  $("#admin-form").addEventListener("submit",async e=>{e.preventDefault();state.adminKey=$("#adminKey").value;await loadAdmin()});
}
async function loadAdmin(){
  try{
    const [summary,movies,theatres]=await Promise.all([
      api("/api/admin/summary",{headers:{"x-admin-key":state.adminKey}}),
      api("/api/admin/movies",{headers:{"x-admin-key":state.adminKey}}),
      api("/api/admin/theatres",{headers:{"x-admin-key":state.adminKey}})
    ]);
    openModal(`<div class="eyebrow muted">CINEBOOK MANAGEMENT</div><h2>Admin dashboard</h2><div class="admin-stats"><div class="admin-stat"><small>Movies</small><strong>${summary.movies}</strong></div><div class="admin-stat"><small>Shows</small><strong>${summary.shows}</strong></div><div class="admin-stat"><small>Demo bookings</small><strong>${summary.bookings}</strong></div><div class="admin-stat"><small>Demo booking total</small><strong>${money(summary.revenue)}</strong></div></div>
      <h3>Add a movie</h3><form id="add-movie"><div class="form-grid"><div class="form-field"><label>Title</label><input name="title" required></div><div class="form-field"><label>Language</label><select name="language"><option>Hindi</option><option>English</option><option>Marathi</option><option>Tamil</option><option>Telugu</option></select></div><div class="form-field"><label>Genre</label><input name="genre" required></div><div class="form-field"><label>Duration</label><input name="duration" placeholder="2h 10m" required></div><div class="form-field"><label>Rating</label><select name="rating"><option>U</option><option>U/A</option><option>A</option></select></div><div class="form-field"><label>Poster image URL</label><input name="poster" type="url" required></div><div class="form-field full"><label>Description</label><input name="description" required></div></div><button class="full-button">Add movie</button></form>
      <h3 style="margin-top:28px">Add a show</h3><form id="add-show"><div class="form-grid"><div class="form-field"><label>Movie</label><select name="movieId">${movies.map(m=>`<option value="${m.id}">${escapeHtml(m.title)}</option>`).join("")}</select></div><div class="form-field"><label>Theatre</label><select name="theatreId">${theatres.map(t=>`<option value="${t.id}">${escapeHtml(t.name)} — ${escapeHtml(t.area)}</option>`).join("")}</select></div><div class="form-field"><label>Date</label><input type="date" name="date" required></div><div class="form-field"><label>Time</label><input type="time" name="time" required></div><div class="form-field"><label>Ticket price (INR)</label><input type="number" name="price" min="1" value="200" required></div></div><button class="full-button">Add show</button></form>
      <h3 style="margin-top:28px">Recent bookings</h3><div class="booking-list">${summary.recent.length?summary.recent.map(b=>`<div class="booking-item"><div><strong>${escapeHtml(b.movie_title)}</strong><br>${escapeHtml(b.customer_name)}<br><span>${escapeHtml(b.id)} · ${escapeHtml(b.seats.join(", "))}</span></div><strong>${money(b.total)}</strong></div>`).join(""):'<p class="modal-sub">No bookings yet.</p>'}</div><p class="modal-sub" style="margin-top:20px">This dashboard uses a simple shared admin key for MVP demonstration. Replace it with proper user roles and secure authentication before production.</p>`);
    $("#add-movie").addEventListener("submit",async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/admin/movies",{method:"POST",headers:{"x-admin-key":state.adminKey},body:JSON.stringify(obj)});toast("Movie added.");await loadMovies();await loadAdmin()}catch(err){toast(err.message)}});
    $("#add-show").addEventListener("submit",async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget));obj.movieId=Number(obj.movieId);obj.theatreId=Number(obj.theatreId);obj.price=Number(obj.price);try{await api("/api/admin/shows",{method:"POST",headers:{"x-admin-key":state.adminKey},body:JSON.stringify(obj)});toast("Show added.");await loadAdmin()}catch(err){toast(err.message)}});
  }catch(e){toast(e.message)}
}
loadMovies();
