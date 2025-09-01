window.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("loginBtn");

  document.getElementById("loginBtn").addEventListener("click", function(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const error = document.getElementById("error");

    const correctUsername = "aslan";
    const correctPassword = "1720204";

    if (username === correctUsername && password === correctPassword) {
      // Перенаправляем на домашнюю страницу
      window.location.href = "./home.html"; 
    } else {
      error.style.display = "block";
    }
  });
});