async function loadRandomComic() {
  try {
    const response = await fetch("/api/random-comic");
    const comic = await response.json();

    if (!comic || comic.error) return;

    const siteNameEl = document.getElementById("randomComicSiteName");
    const imgEl = document.getElementById("randomComicImage");
    const titleEl = document.getElementById("randomComicTitle");
    const dateEl = document.getElementById("randomComicDate");

    if (siteNameEl) siteNameEl.textContent = comic.site_name;
    if (imgEl) {
      imgEl.src = comic.comic_url;
      imgEl.alt = comic.title;
    }
    if (titleEl) titleEl.textContent = comic.title;
    if (dateEl) dateEl.textContent = comic.comic_date;
  } catch (error) {
    console.error("Random comic error:", error);
  }
}

async function showComments(comicId) {
  const modalBody = document.getElementById("commentsModalBody");
  if (!modalBody) return;

  modalBody.innerHTML = "Loading comments...";

  try {
    const response = await fetch(`/api/comments/${comicId}`);
    const comments = await response.json();

     if (!Array.isArray(comments) || comments.length === 0) {
      modalBody.innerHTML = `<p class="mb-0">No comments yet.</p>`;
    } else {
      modalBody.innerHTML = comments.map(c => `
        <div class="comment-item border-bottom pb-3 mb-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <strong>${c.author}</strong>
            <span class="text-muted small">${c.comment_date}</span>
          </div>
          <p class="mb-0">${c.comment}</p>
        </div>
      `).join("");
    }

    const modal = new bootstrap.Modal(document.getElementById("commentsModal"));
    modal.show();
  } catch (error) {
    console.error("Comments error:", error);
    modalBody.innerHTML = `<p class="text-danger mb-0">Could not load comments.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const randomBtn = document.getElementById("btnRandomComic");
  if (randomBtn) {
    randomBtn.addEventListener("click", loadRandomComic);
  }

  document.querySelectorAll(".view-comments-link").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      showComments(link.dataset.comicId);
    });
  });
});