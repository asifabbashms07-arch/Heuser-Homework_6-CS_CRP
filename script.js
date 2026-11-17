/**
 * Fitness Emporium — JavaScript Interactions & Validations (script.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Navigation & Scroll Spy
  const navbar = document.getElementById('navbar');
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    // Opacity change on scroll
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Scroll spy active tab indicator
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.clientHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });

  // 2. Mobile Hamburger Drawer
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navMenu = document.getElementById('navMenu');

  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      hamburgerBtn.setAttribute('aria-expanded', isOpen);
    });

    // Close mobile menu on clicking any navigation link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', false);
      });
    });
  }

  // 3. Membership Quick-Select Integration
  const selectPlanButtons = document.querySelectorAll('.select-plan-btn');
  const planDropdown = document.getElementById('planSelectedDropdown');
  const membershipEnquiryBox = document.getElementById('membershipEnquiryBox');

  selectPlanButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const chosenPlan = btn.getAttribute('data-plan');
      
      // Auto-select in the dropdown
      if (planDropdown) {
        for (let i = 0; i < planDropdown.options.length; i++) {
          if (planDropdown.options[i].text.includes(chosenPlan) || planDropdown.options[i].value.includes(chosenPlan)) {
            planDropdown.selectedIndex = i;
            break;
          }
        }
      }

      // Smooth scroll to the enquiry box
      if (membershipEnquiryBox) {
        membershipEnquiryBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const nameField = document.getElementById('planUserName');
        if (nameField) nameField.focus();
      }
    });
  });

  // 4. Quick Membership Enquiry Form Handler
  const planForm = document.getElementById('planForm');
  const planFormStatus = document.getElementById('planFormStatus');

  if (planForm && planFormStatus) {
    planForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('planUserName').value.trim();
      const phone = document.getElementById('planUserPhone').value.trim();
      const selectedPlan = planDropdown ? planDropdown.value : 'General Membership';

      if (!name || !phone) {
        planFormStatus.className = 'form-feedback error';
        planFormStatus.textContent = 'Please enter both your name and phone number.';
        return;
      }

      // Success notification
      planFormStatus.className = 'form-feedback success';
      planFormStatus.textContent = `Thank you, ${name}! Your inquiry for "${selectedPlan}" has been received. Our team will contact you shortly at ${phone}.`;
      planForm.reset();

      setTimeout(() => {
        planFormStatus.style.display = 'none';
      }, 7000);
    });
  }

  // 5. Gallery Filter Logic
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  filterBtns.forEach(button => {
    button.addEventListener('click', () => {
      filterBtns.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const filterValue = button.getAttribute('data-filter');

      galleryItems.forEach(item => {
        const itemCat = item.getAttribute('data-category');
        if (filterValue === 'all' || itemCat === filterValue) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // 6. Lightbox Preview Modal
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxVisual = document.getElementById('lightboxVisual');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxDesc = document.getElementById('lightboxDesc');

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const overlayText = item.querySelector('.gallery-overlay');
      const title = overlayText.querySelector('h4').textContent;
      const desc = overlayText.querySelector('p').textContent;
      const bgClass = item.querySelector('.gallery-placeholder').className;

      if (lightboxVisual && lightboxTitle && lightboxDesc) {
        lightboxVisual.className = bgClass;
        lightboxTitle.textContent = title;
        lightboxDesc.textContent = desc;
        lightboxModal.classList.add('active');
        lightboxModal.setAttribute('aria-hidden', 'false');
      }
    });
  });

  const closeLightbox = () => {
    if (lightboxModal) {
      lightboxModal.classList.remove('active');
      lightboxModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxOverlay) lightboxOverlay.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('active')) {
      closeLightbox();
    }
  });

  // 7. Contact Form Validation & Submission
  const contactForm = document.getElementById('contactForm');
  const contactFormStatus = document.getElementById('contactFormStatus');

  if (contactForm && contactFormStatus) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Reset errors
      document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

      // Spam honeypot detection
      const hpField = document.getElementById('hpField');
      if (hpField && hpField.value !== '') {
        return; // Silent discard of bot submissions
      }

      const nameInput = document.getElementById('contactName');
      const phoneInput = document.getElementById('contactPhone');
      const emailInput = document.getElementById('contactEmail');
      const subjectInput = document.getElementById('contactSubject');
      const messageInput = document.getElementById('contactMessage');

      let isValid = true;

      // Validate Name
      if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
        document.getElementById('nameError').textContent = 'Please enter your full name (minimum 2 characters).';
        isValid = false;
      }

      // Validate Phone (Pakistan format or international digits)
      const phoneVal = phoneInput.value.trim();
      const phonePattern = /^(\+92|0|0092)?[0-9]{9,11}$/;
      const cleanedPhone = phoneVal.replace(/[\s-]/g, '');

      if (!cleanedPhone || !phonePattern.test(cleanedPhone)) {
        document.getElementById('phoneError').textContent = 'Please enter a valid Pakistani contact number (e.g., 0336-0660676).';
        isValid = false;
      }

      // Validate Email (Optional, but if filled must be valid)
      if (emailInput.value.trim()) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailInput.value.trim())) {
          document.getElementById('emailError').textContent = 'Please provide a valid email address.';
          isValid = false;
        }
      }

      // Validate Subject
      if (!subjectInput.value) {
        document.getElementById('subjectError').textContent = 'Please select a subject of interest.';
        isValid = false;
      }

      // Validate Message
      if (!messageInput.value.trim() || messageInput.value.trim().length < 10) {
        document.getElementById('messageError').textContent = 'Please provide a brief message (minimum 10 characters).';
        isValid = false;
      }

      if (!isValid) return;

      // Form Success Behavior
      contactFormStatus.className = 'form-feedback success';
      contactFormStatus.textContent = `Thank you, ${nameInput.value.trim()}! Your message regarding "${subjectInput.value}" has been received. Our team will contact you shortly.`;
      contactForm.reset();

      setTimeout(() => {
        contactFormStatus.style.display = 'none';
      }, 8000);
    });
  }
});
