const loginForm = document.querySelector("#loginForm");
const loginUser = document.querySelector("#loginUser");
const loginPassword = document.querySelector("#loginPassword");
const loginMessage = document.querySelector("#loginMessage");

const USERS = {
  daniel: { name: "Daniel", password: "123456" },
  felipe: { name: "Felipe", password: "Brasil@2024" },
  dan: { name: "Dan", password: "123456" },
  visitante: { name: "Visitante", password: "123456" }
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function authenticate(name, password) {
  const user = USERS[normalizeText(name)];
  return user?.password === password ? user : null;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = authenticate(loginUser.value, loginPassword.value);

  if (!user) {
    loginMessage.textContent = "Usuário ou senha inválidos.";
    loginPassword.value = "";
    loginPassword.focus();
    return;
  }

  sessionStorage.setItem("admin-user", user.name);
  window.location.replace("admin.html");
});
