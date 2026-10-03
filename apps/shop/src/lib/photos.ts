/** Editorial photography (Unsplash, free licence). */
export const photo = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const HERO = {
  home: { id: 'photo-1763328719057-ff6b03c816d0', alt: "three diverse young adults posing outdoors together", credit: "Christian Agbede" },
  men: { id: 'photo-1617114919297-3c8ddb01f599', alt: "man in a tan jacket and blue jeans leaning against a stone wall", credit: "Mohamad Khosravi" },
  women: { id: 'photo-1562151270-c7d22ceb586a', alt: "woman in yellow long-sleeved dress under white clouds", credit: "Hong Nguyen" },
  kids: { id: 'photo-1497486751825-1233686d5d80', alt: "five children smiling", credit: "LJ" },
};
