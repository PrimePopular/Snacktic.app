import { useState } from 'react';
import { isSoundEnabled, playTap, setSoundEnabled } from '../../services/sound';
import { CheckboxField } from '../../shared/components';

/** Turns the app's sound effects on or off. Saved on this device only. */
export function SoundToggle() {
  const [on, setOn] = useState(isSoundEnabled);

  return (
    <CheckboxField
      checked={on}
      onChange={(event) => {
        const next = event.target.checked;
        setOn(next);
        setSoundEnabled(next);
        if (next) playTap();
      }}
    >
      Sound effects
    </CheckboxField>
  );
}
