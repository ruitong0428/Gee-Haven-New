document.addEventListener("DOMContentLoaded", () => {
  $("#loginForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const identifier = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    let email = identifier;

    // Supabase Auth uses email/password. For Gee Haven we also allow a username.
    if (!identifier.includes("@")) {
      const { data, error } = await db.rpc("get_login_email", { p_username: identifier });
      if (error || !data) return toast("Username not found.", true);
      email = data;
    }

    const { data: loginData, error } = await db.auth.signInWithPassword({email, password});
    if (error) return toast(error.message, true);

    const next = new URLSearchParams(location.search).get("next");
    location.href = next || "index.html";
  });

  $("#registerForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#registerName").value.trim();
    const email = $("#registerEmail").value.trim();
    const password = $("#registerPassword").value;
    if(password.length < 6) return toast("Password must be at least 6 characters.",true);
    const {data,error} = await db.auth.signUp({email,password,options:{data:{full_name:name}}});
    if(error) return toast(error.message,true);
    if(data.session) location.href="index.html";
    else toast("Registration successful. Please check your email if confirmation is enabled.");
  });
});
