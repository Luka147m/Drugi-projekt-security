function deleteComments() {
  fetch('/deleteComments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (response.ok) {
        location.reload();
      } else {
        alert('Brisanje komentara nije bilo uspješno');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      alert('Pogreška tijekom brisanja komentara');
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
          ? 'Isključi zaštitu'
          : 'Uključi zaštitu';

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
