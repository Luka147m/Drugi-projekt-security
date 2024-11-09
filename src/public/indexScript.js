function deleteAllComments() {
  fetch(`/comments`, {
    method: 'DELETE',
  })
    .then((response) => {
      if (response.ok) {
        alert('Komentari uspješno obrisani');
      } else {
        alert('Pogreška tijekom brisanja komentara');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}
