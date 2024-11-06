function toggleBrokenAccess() {
  fetch('/toggleAccessControl', {
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
        let brokenAccessProtection = data.brokenAccessProtection;
        button.textContent = brokenAccessProtection
          ? 'Zaštita je uključena'
          : 'Zaštita je isključena';

        if (brokenAccessProtection) {
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
