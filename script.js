// Handles state management, rendering, and user interactions for the
// front‑end prototype of TheMemes. Posts are persisted to localStorage under
// the key `thememes_posts`. Each post contains an `id`, a base64 data URL
// representing the uploaded image, a timestamp (milliseconds since epoch),
// and a like counter. Sorting and filtering occurs client‑side.

(() => {
  /**
   * Reads persisted posts from localStorage. If none exist, returns an
   * empty array. This function gracefully handles malformed JSON by
   * resetting the storage to an empty array.
   * @returns {Array<{id:string,dataUrl:string,timestamp:number,likes:number}>}
   */
  function loadPosts() {
    try {
      const raw = localStorage.getItem('thememes_posts');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn('Failed to parse posts from localStorage:', e);
    }
    // Reset on error
    localStorage.removeItem('thememes_posts');
    return [];
  }

  /**
   * Persists a list of posts to localStorage. Swallows exceptions because
   * browsers may throw (e.g. storage quota) and we don't want the app to
   * crash. In a production environment you would surface this to the user.
   * @param {Array} posts
   */
  function savePosts(posts) {
    try {
      localStorage.setItem('thememes_posts', JSON.stringify(posts));
    } catch (e) {
      console.warn('Failed to save posts:', e);
    }
  }

  /**
   * Returns a human‑friendly relative time string like "10 minutes ago" or
   * "3 hours ago". Falls back to a date string if more than a week has
   * passed. Times are computed against the current timestamp.
   * @param {number} timestamp
   * @returns {string}
   */
  function relativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return 'just now';
    if (diff < hour) {
      const mins = Math.floor(diff / minute);
      return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    }
    if (diff < day) {
      const hrs = Math.floor(diff / hour);
      return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    }
    if (diff < 7 * day) {
      const days = Math.floor(diff / day);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    // For posts older than a week show a locale date
    const d = new Date(timestamp);
    return d.toLocaleDateString();
  }

  /**
   * Renders the list of posts into the DOM. Sorting is based on the
   * `currentFilter` variable: "latest" sorts by timestamp descending,
   * "top" sorts by like count descending (breaking ties by timestamp).
   */
  function renderPosts() {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    let posts = loadPosts();
    if (currentFilter === 'top') {
      posts = posts.slice().sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        return b.timestamp - a.timestamp;
      });
    } else {
      // latest
      posts = posts.slice().sort((a, b) => b.timestamp - a.timestamp);
    }
    posts.forEach((post) => {
      const card = document.createElement('article');
      card.className =
        'bg-gray-900 rounded-lg overflow-hidden shadow-md max-w-xl mx-auto';
      // Image container
      const img = document.createElement('img');
      img.src = post.dataUrl;
      img.alt = 'Uploaded meme';
      img.className = 'w-full object-contain';
      card.appendChild(img);
      // Footer with likes and time
      const footer = document.createElement('div');
      footer.className =
        'flex items-center justify-between px-4 py-3 bg-gray-800';
      // Like button and count
      const likeBtn = document.createElement('button');
      likeBtn.className =
        'flex items-center gap-1 text-pink-400 hover:text-pink-300 focus:outline-none';
      likeBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 512 512" class="w-5 h-5"><path d="M462.3 62.7C407 7.4 324.8-10 256 32.3 187.2-10 105-7.4 49.7 62.7c-54.5 66.3-46.4 165.6 15.6 221.7L239 470.6a32 32 0 0 0 45.2 0l173.8-186.2c62-56.1 70.1-155.4 4.5-221.7z"/></svg>';
      const likeCount = document.createElement('span');
      likeCount.textContent = post.likes;
      likeBtn.appendChild(likeCount);
      likeBtn.addEventListener('click', () => {
        const posts = loadPosts();
        const idx = posts.findIndex((p) => p.id === post.id);
        if (idx >= 0) {
          posts[idx].likes += 1;
          savePosts(posts);
          renderPosts();
        }
      });
      footer.appendChild(likeBtn);
      // Timestamp
      const time = document.createElement('span');
      time.className = 'text-gray-400 text-sm';
      time.textContent = relativeTime(post.timestamp);
      footer.appendChild(time);
      card.appendChild(footer);
      container.appendChild(card);
    });
  }

  // Keep track of which filter is active
  let currentFilter = 'latest';

  // Event handler for file uploads
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const posts = loadPosts();
      posts.push({
        id: String(Date.now()),
        dataUrl: e.target.result,
        timestamp: Date.now(),
        likes: 0,
      });
      savePosts(posts);
      // Reset file input value to allow uploading the same file again
      event.target.value = '';
      // Switch to "latest" after upload
      selectFilter('latest');
    };
    reader.readAsDataURL(file);
  }

  /**
   * Highlights the selected tab and re-renders posts. Acceptable values are
   * 'latest' and 'top'. Any other value is ignored.
   * @param {string} filter
   */
  function selectFilter(filter) {
    if (filter !== 'latest' && filter !== 'top') return;
    currentFilter = filter;
    // Update button styles
    const latestBtn = document.getElementById('latestTab');
    const topBtn = document.getElementById('topTab');
    if (filter === 'latest') {
      latestBtn.classList.add('text-yellow-400', 'border-b-2', 'border-yellow-400');
      latestBtn.classList.remove('text-gray-400');
      topBtn.classList.remove('text-yellow-400', 'border-b-2', 'border-yellow-400');
      topBtn.classList.add('text-gray-400');
    } else {
      topBtn.classList.add('text-yellow-400', 'border-b-2', 'border-yellow-400');
      topBtn.classList.remove('text-gray-400');
      latestBtn.classList.remove('text-yellow-400', 'border-b-2', 'border-yellow-400');
      latestBtn.classList.add('text-gray-400');
    }
    renderPosts();
  }

  // Setup event listeners after DOM has loaded
  document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const latestBtn = document.getElementById('latestTab');
    const topBtn = document.getElementById('topTab');
    // Bind events
    fileInput.addEventListener('change', handleFileSelect);
    uploadBtn.addEventListener('click', () => fileInput.click());
    latestBtn.addEventListener('click', () => selectFilter('latest'));
    topBtn.addEventListener('click', () => selectFilter('top'));
    // Initial render
    renderPosts();
  });
})();
