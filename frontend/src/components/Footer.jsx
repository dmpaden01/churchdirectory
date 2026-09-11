import './Footer.css';

// Shown at the bottom of every page (see App.jsx) - sticks to the bottom of
// the viewport on short pages via the margin-top: auto trick in Footer.css,
// and simply follows the content on pages long enough to scroll.
export default function Footer() {
  return (
    <footer className="app-footer">
      <p>&copy; 2026 Centerville Church of Christ</p>
      <p>All Rights Reserved</p>
    </footer>
  );
}
