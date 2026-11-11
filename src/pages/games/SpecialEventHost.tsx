import { lazy, Suspense } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { navigate } from '../../core/router';
import type { SpecialEventDefinition, SpecialEventProps } from '../../games/game.types';
import { findSpecialEvent, isEventActive } from '../../games/registry';
import { Button, EmptyState, Loading, PageHeader } from '../../shared/components';

const loaded = new Map<string, LazyExoticComponent<ComponentType<SpecialEventProps>>>();

function componentFor(event: SpecialEventDefinition) {
  let component = loaded.get(event.id);
  if (!component) {
    component = lazy(event.load);
    loaded.set(event.id, component);
  }
  return component;
}

/** Runs one special event, but only while it is active. */
export function SpecialEventHost({ id }: { id: string }) {
  const event = findSpecialEvent(id);

  if (!event || !isEventActive(event)) {
    return (
      <EmptyState title="This event has ended" action={<Button to="/games">Back to games</Button>}>
        Special events only run for a short time. Check the Games page for what's on now.
      </EmptyState>
    );
  }

  const EventComponent = componentFor(event);

  return (
    <>
      <PageHeader title={event.title} description={event.summary} />
      <Suspense fallback={<Loading label="Loading event" />}>
        <EventComponent onExit={() => navigate('/games')} />
      </Suspense>
    </>
  );
}
