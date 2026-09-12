/* Approved TV layout. Content, media and playback remain sourced from index.html. */
document.querySelectorAll('.sel-slide').forEach(slide => {
  const contact = slide.querySelector('.sel-contact');
  if (contact) slide.append(contact);
  if (slide.querySelector('.sel-class-title')) slide.classList.add('layout-class');
});
const routes = document.querySelector('.activity--routes');
if (routes) {
  const cards = routes.querySelectorAll('.route');
  routes.querySelectorAll('.speaker-card').forEach((speaker, index) => cards[index]?.append(speaker));
}
