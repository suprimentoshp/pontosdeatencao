const form = document.querySelector("#serviceForm");
const protocolNumber = document.querySelector("#protocolNumber");
const issuedAtLabel = document.querySelector("#issuedAtLabel");
const photoInput = document.querySelector("#photo");
const photoPreview = document.querySelector("#photoPreview");
const photoCaption = document.querySelector("#photoCaption");
const photoBox = document.querySelector(".photo-box");
const cameraView = document.querySelector("#cameraView");
const cameraCanvas = document.querySelector("#cameraCanvas");
const openCameraButton = document.querySelector("#openCameraButton");
const captureButton = document.querySelector("#captureButton");
const closeCameraButton = document.querySelector("#closeCameraButton");
const removePhotoButton = document.querySelector("#removePhotoButton");
const cameraMessage = document.querySelector("#cameraMessage");
const urgencyInput = document.querySelector("#urgency");
const urgencyButtons = document.querySelectorAll("[data-urgency]");

let currentProtocol = "";
let currentIssuedAt = "";
let currentPhoto = "";
let cameraStream = null;

function createProtocol() {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replaceAll("-", "");
  const timePart = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");
  return `OS-${datePart}-${timePart}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function resetPhoto() {
  currentPhoto = "";
  photoInput.value = "";
  photoPreview.removeAttribute("src");
  photoBox.classList.remove("has-photo");
  photoCaption.textContent = "Nenhuma foto anexada";
  removePhotoButton.hidden = true;
}

function setCameraMessage(message) {
  cameraMessage.textContent = message || "";
}

function setPhotoPreview(photo, caption) {
  currentPhoto = photo;
  photoPreview.src = currentPhoto;
  photoBox.classList.add("has-photo");
  photoCaption.textContent = caption;
  removePhotoButton.hidden = false;
}

async function openCamera() {
  setCameraMessage("");

  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraMessage("Este navegador não permite câmera direta.");
    photoInput.click();
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    cameraView.srcObject = cameraStream;
    cameraView.classList.add("active");
    captureButton.hidden = false;
    closeCameraButton.hidden = false;
    openCameraButton.hidden = true;
  } catch {
    setCameraMessage("Não foi possível abrir a câmera. Verifique a permissão do navegador.");
    photoInput.click();
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  cameraView.srcObject = null;
  cameraView.classList.remove("active");
  captureButton.hidden = true;
  closeCameraButton.hidden = true;
  openCameraButton.hidden = false;
}

function capturePhoto() {
  if (!cameraStream || !cameraView.videoWidth) return;

  cameraCanvas.width = cameraView.videoWidth;
  cameraCanvas.height = cameraView.videoHeight;
  cameraCanvas.getContext("2d").drawImage(cameraView, 0, 0);
  setPhotoPreview(cameraCanvas.toDataURL("image/jpeg", 0.9), "Foto capturada pela câmera");
  closeCamera();
}

function handlePhotoChange() {
  const file = photoInput.files[0];

  if (!file) {
    resetPhoto();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setPhotoPreview(reader.result, file.name || "Foto capturada");
  };
  reader.readAsDataURL(file);
}

function collectOrder() {
  const data = Object.fromEntries(new FormData(form));
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    protocol: currentProtocol,
    issuedAt: currentIssuedAt,
    status: "Nova",
    recipient: data.recipient.trim(),
    issuer: data.issuer.trim(),
    room: data.room.trim(),
    urgency: data.urgency,
    description: data.description.trim(),
    photo: currentPhoto
  };
}

function startNewOrder() {
  currentProtocol = createProtocol();
  currentIssuedAt = new Date().toISOString();
  protocolNumber.textContent = currentProtocol;
  issuedAtLabel.textContent = formatDateTime(currentIssuedAt);
  resetPhoto();
}

async function submitOrder(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;

  await OrderStore.create(collectOrder());
  alert("Ordem registrada. Ela já está disponível no painel administrativo.");
  form.reset();
}

form.addEventListener("submit", submitOrder);
photoInput.addEventListener("change", handlePhotoChange);
openCameraButton.addEventListener("click", openCamera);
captureButton.addEventListener("click", capturePhoto);
closeCameraButton.addEventListener("click", closeCamera);
removePhotoButton.addEventListener("click", resetPhoto);
urgencyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    urgencyInput.value = button.dataset.urgency;
    urgencyButtons.forEach((item) => item.classList.toggle("active", item === button));
  });
});

form.addEventListener("reset", () => {
  window.setTimeout(startNewOrder, 0);
});

startNewOrder();
