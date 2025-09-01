window.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("loginBtn");

  button.addEventListener("click", (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const error = document.getElementById("error");

    const correctUsername = "aslan";
    const correctPassword = "1720204";

    if (username === correctUsername && password === correctPassword) {
      window.location.href = "https://aslanparcel.netlify.app";
    } else {
      error.style.display = "block";
    }
  });
});