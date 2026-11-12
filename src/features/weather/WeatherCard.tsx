import { useEffect, useState } from 'react';
import { getCampusWeather } from './weather';
import type { Weather } from './weather';
import './weather.css';

/** A slim weather card for Home. Shows nothing until the owner has set the campus location. */
export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    let active = true;
    void getCampusWeather().then((value) => {
      if (active) setWeather(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!weather) return null;
  return (
    <section className="weather-card" aria-label={`Weather at ${weather.place}`}>
      <span className="weather-card__emoji" aria-hidden="true">{weather.emoji}</span>
      <div>
        <strong>
          {weather.now}° at {weather.place}
        </strong>
        <p>
          {weather.summary}. Today {weather.low}° to {weather.high}°.
          {weather.rainChance >= 40 ? ` ${weather.rainChance}% chance of rain, take an umbrella.` : ''}
        </p>
      </div>
    </section>
  );
}
