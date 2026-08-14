// Gestion du Carrousel interactif, de la galerie et des animations de la page d'accueil

document.addEventListener('DOMContentLoaded', () => {
    initHeroCarousel();
    initGalleryLightbox();
    initScrollAnimations();
});

// --- 1. Carrousel Héro interactif avec swipe mobile et auto-play ---
function initHeroCarousel() {
    const carousel = document.querySelector('.hero-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.carousel-slide');
    const dotsContainer = carousel.querySelector('.carousel-dots');
    const prevBtn = carousel.querySelector('.carousel-arrow.prev');
    const nextBtn = carousel.querySelector('.carousel-arrow.next');

    if (!slides.length) return;

    let currentIndex = 0;
    let autoPlayTimer = null;
    let touchStartX = 0;
    let touchEndX = 0;

    // Générer dynamiquement les puces (dots)
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
            dot.setAttribute('aria-label', `Aller à la diapositive ${index + 1}`);
            dot.addEventListener('click', () => goToSlide(index));
            dotsContainer.appendChild(dot);
        });
    }

    const dots = dotsContainer ? dotsContainer.querySelectorAll('.carousel-dot') : [];

    function goToSlide(index) {
        // Gérer le débordement
        if (index < 0) {
            currentIndex = slides.length - 1;
        } else if (index >= slides.length) {
            currentIndex = 0;
        } else {
            currentIndex = index;
        }

        // Mettre à jour les classes active
        slides.forEach((slide, i) => {
            if (i === currentIndex) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });

        dots.forEach((dot, i) => {
            if (i === currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        resetAutoPlay();
    }

    function nextSlide() {
        goToSlide(currentIndex + 1);
    }

    function prevSlide() {
        goToSlide(currentIndex - 1);
    }

    // Événements boutons
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);

    // Auto-play (5 secondes)
    function startAutoPlay() {
        stopAutoPlay();
        autoPlayTimer = setInterval(nextSlide, 5000);
    }

    function stopAutoPlay() {
        if (autoPlayTimer) clearInterval(autoPlayTimer);
    }

    function resetAutoPlay() {
        stopAutoPlay();
        startAutoPlay();
    }

    // Pause sur survol/toucher
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);

    // Support des gestes tactiles (Mobile Swipe)
    carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 40; // Seuil minimum en pixels
        const deltaX = touchEndX - touchStartX;

        if (deltaX < -swipeThreshold) {
            nextSlide(); // Swipe gauche -> slide suivante
        } else if (deltaX > swipeThreshold) {
            prevSlide(); // Swipe droite -> slide précédente
        }
    }

    // Lancer le carrousel
    goToSlide(0);
    startAutoPlay();
}

// --- 2. Galerie Lightbox interactive pour la page d'accueil ---
function initGalleryLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item img');
    if (!galleryItems.length) return;

    // Créer dynamiquement la modal Lightbox
    const lightbox = document.createElement('div');
    lightbox.id = 'galleryLightboxModal';
    lightbox.className = 'gallery-lightbox-modal';
    lightbox.innerHTML = `
        <div class="lightbox-overlay"></div>
        <div class="lightbox-content">
            <button class="lightbox-close" aria-label="Fermer la vue grand format">&times;</button>
            <img src="" alt="Vue grand format" class="lightbox-img" />
            <p class="lightbox-caption"></p>
        </div>
    `;
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector('.lightbox-img');
    const lightboxCaption = lightbox.querySelector('.lightbox-caption');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const overlay = lightbox.querySelector('.lightbox-overlay');

    galleryItems.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            lightboxImg.src = img.src;
            lightboxCaption.textContent = img.alt || 'Institut National de Formation des Jeunes';
            lightbox.classList.add('open');
            document.body.style.overflow = 'hidden'; // Bloquer le défilement
        });
    });

    const closeLightbox = () => {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
    };

    closeBtn.addEventListener('click', closeLightbox);
    overlay.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('open')) {
            closeLightbox();
        }
    });
}

// --- 3. Animations au défilement (Scroll Reveal) ---
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.card-blue-accent, .card-orange-accent, .devise-card, .piliers-card, .gallery-item, .stat-item');
    
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-revealed');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(el => {
        el.classList.add('scroll-hidden');
        observer.observe(el);
    });
}
