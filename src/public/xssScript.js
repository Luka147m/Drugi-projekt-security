document.addEventListener('DOMContentLoaded', () => {
  document.cookie =
    'testniCookie=superTajnaTajna; path=/pohranjeniXSS; max-age=86400;';
  // document.cookie =
  //   'testniSigurniCookie=superTajnaTajna; path=/pohranjeniXSS; max-age=86400;Secure; HttpOnly';

  updateCommentsList();
  // setInterval(updateCommentsList, 5000);
});

function addComment(event) {
  event.preventDefault();
  const commentText = document.querySelector('textarea[name="comment"]').value;

  fetch('/addComment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: commentText }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        document.querySelector('textarea[name="comment"]').value = '';
        updateCommentsList();
      } else {
        alert('Pogreška tijekom dodavanja komentara');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

function updateCommentsList() {
  fetch('/comments', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => response.json())
    .then((comments) => {
      const commentsList = document.getElementById('comments-ul');
      commentsList.innerHTML = '';

      comments.forEach((comment) => {
        const commentItem = document.createElement('li');

        const commentContainer = document.createElement('div');
        commentContainer.classList.add('list-item');

        const commentText = document.createElement('span');
        commentText.innerHTML = comment.comment_text;
        commentText.classList.add('item-text');

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️';
        deleteButton.onclick = () => deleteComment(comment.id);
        deleteButton.classList.add('delete-button');

        commentContainer.appendChild(commentText);
        commentContainer.appendChild(deleteButton);

        commentItem.appendChild(commentContainer);
        commentsList.appendChild(commentItem);
      });
    })
    .catch((error) => {
      console.error('Pogreška tijekom dohvaćanja komentara:', error);
    });
}

function deleteComment(id) {
  fetch(`/comments/${id}`, {
    method: 'DELETE',
  })
    .then((response) => {
      if (response.ok) {
        alert('Komentar uspješno obrisan');
        updateCommentsList();
      } else {
        alert('Pogreška tijekom brisanja komentara');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

function deleteAllComments() {
  fetch(`/comments`, {
    method: 'DELETE',
  })
    .then((response) => {
      if (response.ok) {
        alert('Komentari uspješno obrisani');
        updateCommentsList();
      } else {
        alert('Pogreška tijekom brisanja komentara');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

function toggleXSSProtection() {
  fetch('/toggleXSSProtection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        alert('Neuspjelo uključivanje/isključivanje zaštite');
        throw new Error('Server error');
      }
    })
    .then((data) => {
      const button = document.getElementById('protection-btn');
      const iconContainer = document.getElementById('protection-icon');
      if (data) {
        console.log(data);
        let xssProtection = data.xssProtection;
        button.textContent = xssProtection
          ? 'Zaštita je uključena'
          : 'Zaštita je isključena';

        if (xssProtection) {
          iconContainer.style.visibility = 'visible';
        } else {
          iconContainer.style.visibility = 'hidden';
        }
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      alert('Pogreška tijekom uključivanja/isključivanja zaštite');
    });
}
