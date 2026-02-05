import { auth } from "../state/auth-state.js";
import { requireLogin } from "../core/guards.js";
import { showItemsAdmin } from "./admin/items-page.js";
import { showCouponsAdmin } from "./admin/coupons-page.js";
import { showNewsletterAdmin } from "./admin/newsletter-page.js";
import { showUsersAdmin } from "./admin/users-page.js";
import { showReviewsAdmin } from "./admin/reviews-page.js";
import { showBookingsAdmin } from "./admin/bookings-page.js";
import { showBlogAdmin } from "./admin/blog-page.js";

export async function initAdminPage() {
    // assicura auth aggiornata se arrivi con reload diretto
    if (!(await requireLogin())) return;

    if (!auth.user || auth.user.role !== "admin") {
        alert("Accesso riservato agli amministratori.");
        window.page.show("/");
        return;
    }

    const panel = document.getElementById("admin-panel");
    const btnItems = document.getElementById("btn-admin-items");
    const btnCoupons = document.getElementById("btn-admin-coupons");
    const btnNews = document.getElementById("btn-admin-news");
    const btnUsers = document.getElementById("btn-admin-users");
    const btnReviews = document.getElementById("btn-admin-reviews");
    const btnBookings = document.getElementById("btn-admin-bookings");
    const btnBlog = document.getElementById("btn-admin-blog");

    btnItems.addEventListener("click", () => showItemsAdmin(panel));
    btnCoupons.addEventListener("click", () => showCouponsAdmin(panel));
    btnNews.addEventListener("click", () => showNewsletterAdmin(panel));
    btnUsers.addEventListener("click", () => showUsersAdmin(panel));
    btnReviews.addEventListener("click", () => showReviewsAdmin(panel));
    btnBookings.addEventListener("click", () => showBookingsAdmin(panel));
    btnBlog.addEventListener("click", () => showBlogAdmin(panel));

    // apri di default la gestione prenotazioni
    showBookingsAdmin(panel);
}
