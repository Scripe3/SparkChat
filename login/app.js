import * as sdk from "https://esm.sh/matrix-js-sdk?bundle";

let client;

function ssoLogin() {
  import("https://esm.sh/matrix-js-sdk?bundle").then(async (sdk) => {
    const client = sdk.createClient({
      baseUrl: "https://matrix.org"
    });

    const url = await client.getSsoLoginUrl(window.location.origin + "/callback.html");

    console.log("To complate SSO Login, login with this url: ", url);
    window.location.href = url;
  });
}

async function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;
  const status = document.getElementById("status");

  status.innerText = "Giriş yapılıyor...";

  try {
    client = sdk.createClient({
      baseUrl: "https://matrix.org"
    });

    const res = await client.login("m.login.password", {
      user: "@" + user + ":matrix.org",
      password: pass
    });

    localStorage.setItem("mx_token", res.access_token);
    localStorage.setItem("mx_user", user);

    status.innerText = "Başarılı! Yönlendiriliyor...";

    setTimeout(() => {
      window.location.href = "../index.html";
    }, 800);

  } catch (err) {
    console.error(err);
    status.innerText = "Giriş başarısız!";
  }
}

globalThis.login = login;
globalThis.ssoLogin = ssoLogin;
