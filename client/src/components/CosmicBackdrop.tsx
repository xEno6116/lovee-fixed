const STARS = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  left: (index * 37 + 11) % 100,
  top: (index * 61 + 7) % 100,
  size: index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1,
  delay: (index % 11) * -0.55,
  duration: 3.8 + (index % 7) * 0.45,
}));

export default function CosmicBackdrop() {
  return (
    <div className="cosmic-backdrop" aria-hidden="true">
      <span className="cosmic-nebula cosmic-nebula-one" />
      <span className="cosmic-nebula cosmic-nebula-two" />
      <span className="cosmic-nebula cosmic-nebula-three" />
      <span className="cosmic-orbit cosmic-orbit-one" />
      <span className="cosmic-orbit cosmic-orbit-two" />
      <div className="cosmic-stars">
        {STARS.map((star) => (
          <i
            key={star.id}
            className="cosmic-star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
