document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.getElementById("menu-toggle");
    const navMenu = document.getElementById("nav-menu");
    const mobileMenu = document.createElement("div");
    mobileMenu.className = "mobile-menu";
    
    // Clone the nav content to our mobile menu
    mobileMenu.innerHTML = navMenu.innerHTML;
    document.body.appendChild(mobileMenu);
    
    let lastScrollTop = 0;
    const navbar = document.getElementById("navbar");

    // Toggle mobile menu
    menuToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        if (mobileMenu.classList.contains("active")) {
            mobileMenu.style.display = "none"; // إخفاء بعد انتهاء الـ fade out
        } else {
            mobileMenu.style.display = "block";
            setTimeout(() => {
                mobileMenu.classList.add("active"); // تفعيل fade in بعد عرض العنصر
            }, 10);
        }
        mobileMenu.classList.toggle("active");
    });
    

    // Hide navbar on scroll down, show on scroll up
    window.addEventListener("scroll", function () {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop) {
            navbar.style.top = "-70px";
            mobileMenu.classList.remove("active");
        } else {
            navbar.style.top = "0";
        }
        lastScrollTop = scrollTop;
    });

    // Close menu when clicking outside
    document.addEventListener("click", function (event) {
        if (!mobileMenu.contains(event.target) && !menuToggle.contains(event.target)) {
            mobileMenu.classList.remove("active");
        }
    });
});