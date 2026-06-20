const API = "";
async function loadDecks(){
  const res = await fetch(API + "/decks");
  const data = await res.json();
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  data.forEach(d => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <div><b>${d.name}</b></div>
      <div>${d.description || ""}</div>
      <div class="price">NZD ${d.price || 0}</div>
      <div>ID: ${d.id}</div>
      <button onclick="openDeck(${d.id})">Open</button>
    `;
    grid.appendChild(el);
  });
}
function openDeck(id){
  window.location = "deck.html?id=" + id;
}
async function createDeck(){
  const name = document.getElementById("name").value;
  const desc = document.getElementById("desc").value;
  const price = document.getElementById("price").value;
  const token = localStorage.getItem("token");
  await fetch(API + "/deck", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":"Bearer " + token
    },
    body: JSON.stringify({name, description: desc, price})
  });
  loadDecks();
}
loadDecks();
