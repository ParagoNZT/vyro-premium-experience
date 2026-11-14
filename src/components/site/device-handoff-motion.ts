import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function setupHandoffMotion(section: HTMLElement) {
  gsap.registerPlugin(ScrollTrigger);
  const select = gsap.utils.selector(section);
  const track = select(".device-handoff-track")[0];
  const devices = select(".device-handoff-device");
  const [tv, tablet, phone] = devices;
  const [tabletSignal, phoneSignal] = select("[data-signal]");
  const steps = select("[data-handoff-step]");
  if (!track || !tv || !tablet || !phone || !tabletSignal || !phoneSignal || steps.length !== 3)
    return;

  let active = -1;
  function setActive(index: number) {
    if (active === index) return;
    active = index;
    devices.forEach((device, i) => device.toggleAttribute("data-active", index === i));
    steps.forEach((step, i) => step.toggleAttribute("data-active", index === i));
  }

  const context = gsap.context(() => {
    const timeline = gsap.timeline({
      defaults: { ease: "power1.inOut" },
      scrollTrigger: {
        trigger: track,
        start: "top 50%",
        end: "bottom 73%",
        scrub: 0.35,
        invalidateOnRefresh: true,
      },
    });

    gsap.set([tablet, phone], { y: 10, opacity: 0.76 });
    gsap.set([tabletSignal, phoneSignal], { strokeDashoffset: 1 });
    setActive(0);
    timeline
      .addLabel("tablet", 0.22)
      .addLabel("phone", 0.65)
      .to(tabletSignal, { strokeDashoffset: 0, duration: 0.23 }, "tablet")
      .to(tv, { y: 4, opacity: 0.84, duration: 0.23 }, "tablet+=0.07")
      .to(tablet, { y: -8, opacity: 1, duration: 0.24 }, "tablet+=0.13")
      .to(phoneSignal, { strokeDashoffset: 0, duration: 0.23 }, "phone")
      .to(tablet, { y: 0, opacity: 0.88, duration: 0.23 }, "phone+=0.08")
      .to(phone, { y: -9, opacity: 1, duration: 0.22 }, "phone+=0.13");
    timeline.eventCallback("onUpdate", () => {
      const progress = timeline.progress();
      setActive(progress >= 0.76 ? 2 : progress >= 0.35 ? 1 : 0);
    });
  }, section);

  return () => {
    context.revert();
    setActive(-1);
  };
}
