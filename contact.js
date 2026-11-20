const form = document.getElementById("contactForm");

form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const body = [
    "Contact Wave Skincare",
    "",
    "Nom : " + String(data.get("name") || "").trim(),
    "E-mail : " + String(data.get("email") || "").trim(),
    "Objet : " + String(data.get("subject") || "").trim(),
    "",
    "Message :",
    String(data.get("message") || "").trim()
  ].join("\n");

  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Préparation du message…";
  }

  try {
    if (navigator.share) {
      await navigator.share({ title: "Contact Wave Skincare", text: body });
      if (button) button.textContent = "Message prêt";
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(body);
      if (button) button.textContent = "Message copié";
      window.alert("Votre message a été copié. Vous pouvez le coller dans WhatsApp ou votre application de messagerie.");
    } else {
      window.prompt("Copiez votre message :", body);
      if (button) button.textContent = "Message préparé";
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      window.prompt("Copiez votre message :", body);
    }
  } finally {
    window.setTimeout(() => {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel || "Préparer mon message →";
      }
    }, 2200);
  }
});