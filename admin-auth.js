document.addEventListener("DOMContentLoaded", () => {
  $("#adminLoginForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#adminEmail").value.trim();
    const password = $("#adminPassword").value;

    // Quick demo Admin shortcut for previewing the admin panel without a
    // real Supabase account. Only works here, on the admin login page.
    if (email.toLowerCase() === "admin" && password === "password123") {
      localStorage.setItem("gee_admin_demo", "1");
      location.href = "index.html";
      return;
    }

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return toast(error.message, true);

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      await db.auth.signOut();
      return toast("无法读取账号权限（profiles 表查询失败）：" + profileError.message, true);
    }

    if (!profile || !["admin", "staff"].includes(profile.role)) {
      await db.auth.signOut();
      return toast(`这个账号（${email}）不是管理员/员工账号，当前角色: ${profile?.role || "无 profile 记录"}。请用管理员账号登录，或联系系统管理员开通权限。`, true);
    }

    const next = new URLSearchParams(location.search).get("next");
    location.href = next || "index.html";
  });
});
