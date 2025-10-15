(() => {
  // Initialize Supabase client
  const supabaseUrl = 'https://swatstbagrwqwhmdqqck.supabase.co';
  const supabaseAnonKey = 'sbp_b1665bdc2cc3793ce82dca6af72ddf0333f2d30';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

  // DOM elements
  const postsContainer = document.getElementById('postsContainer');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const latestTab = document.getElementById('latestTab');
  const topTab = document.getElementById('topTab');

  // Current view filter: 'latest' or 'top'
  let currentFilter = 'latest';

  /**
   * Generate a human‑friendly relative time string from an ISO date.
   * Falls back to locale date string if older than a week.
   * @param {string} dateString ISO timestamp
   * @returns {string}
   */
  function relativeTime(dateString) {
    const timestamp = new Date(dateString).getTime();
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return 'just now';
    if (diff < hour) {
      const mins = Math.floor(diff / minute);
      return `${mins}${mins !== 1 ? ' mins' : ' min'} ago`;
    }
    if (diff < day) {
      const hrs = Math.floor(diff / hour);
      return `${hrs}${hrs !== 1 ? ' hrs' : ' hr'} ago`;
    }
    if (diff < 7 * day) {
      const days = Math.floor(diff / day);
      return `${days}${days !== 1 ? ' days' : ' day'} ago`;
    }
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Fetch memes from the Supabase "Memes" table.
   * Orders by created_at for latest or likes for top.
   * @returns {Promise<Array>}
   */
  async function loadPosts() {
    let query = supabaseClient.from('Memes').select('*');
    if (currentFilter === 'latest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('likes', { ascending: false });
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error loading posts', error);
      return [];
    }
    return data;
  }

  /**
   * Render posts into the DOM. Clears existing content and repopulates.
   */
  async function renderPosts() {
    const posts = await loadPosts();
    postsContainer.innerHTML = '';
    if (!posts || posts.length === 0) {
      postsContainer.innerHTML = '<p class="text-gray-400">No memes found.</p>';
      return;
    }
    posts.forEach((post) => {
      const card = document.createElement('div');
      card.className = 'my-6';
      card.innerHTML = `
        <div class="relative">
          <img src="${post.url}" alt="meme" class="w-full max-h-96 object-cover rounded-lg border border-gray-700">
          <button class="absolute bottom-2 left-2 flex items-center space-x-1 text-pink-500 hover:text-pink-400 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" class="w-5 h-5"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 015.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path></svg>
            <span>${post.likes}</span>
          </button>
        </div>
        <p class="mt-1 text-sm text-gray-400">${relativeTime(post.created_at)}</p>
      `;
      const likeBtn = card.querySelector('button');
      likeBtn.addEventListener('click', async () => {
        // Optimistically update UI
        const currentLikes = post.likes || 0;
        likeBtn.querySelector('span').textContent = currentLikes + 1;
        // Update in Supabase
        const { data: updated, error } = await supabaseClient
          .from('Memes')
          .update({ likes: currentLikes + 1 })
          .eq('id', post.id)
          .select()
          .single();
        if (!error && updated) {
          post.likes = updated.likes;
          likeBtn.querySelector('span').textContent = updated.likes;
        } else if (error) {
          console.error('Failed to update likes', error);
          // revert UI on failure
          likeBtn.querySelector('span').textContent = currentLikes;
        }
      });
      postsContainer.appendChild(card);
    });
  }

  // Initial render
  renderPosts();

  // Show file picker when upload button clicked
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle file selection and upload to Supabase
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input value to allow uploading the same file again later
    e.target.value = '';
    const filePath = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('memes')
      .upload(filePath, file);
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      return;
    }
    const { data: urlData, error: urlError } = await supabaseClient.storage
      .from('memes')
      .getPublicUrl(filePath);
    if (urlError) {
      alert('Failed to get public URL: ' + urlError.message);
      return;
    }
    const publicUrl = urlData.publicUrl;
    // Insert record into table
    const { error: insertError } = await supabaseClient
      .from('Memes')
      .insert([{ url: publicUrl, likes: 0 }]);
    if (insertError) {
      alert('Failed to save meme: ' + insertError.message);
      return;
    }
    // Refresh feed after successful upload
    await renderPosts();
  });

  // Tab click handlers
  latestTab.addEventListener('click', () => {
    currentFilter = 'latest';
    latestTab.classList.add('text-yellow-400', 'border-b-2', 'border-yellow-400');
    topTab.classList.remove('text-yellow-400', 'border-b-2', 'border-yellow-400');
    renderPosts();
  });

  topTab.addEventListener('click', () => {
    currentFilter = 'top';
    topTab.classList.add('text-yellow-400', 'border-b-2', 'border-yellow-400');
    latestTab.classList.remove('text-yellow-400', 'border-b-2', 'border-yellow-400');
    renderPosts();
  });
})();
