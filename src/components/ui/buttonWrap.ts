/**
 * Labels in other languages can be much longer than English ("You can ask for a new code in 31 seconds." is a button
 * label; "Отправить предложение (симуляция)" does not fit a 320 px form on one line), so buttons on forms wrap onto a
 * second line instead of running out of their card. These classes override the Button's default `whitespace-nowrap`
 * and fixed height; pick the one that matches the button's size.
 */
export const wrapSm = 'h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-center leading-snug';
export const wrapMd = 'h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-center leading-snug';
export const wrapLg = 'h-auto min-h-11 max-w-full whitespace-normal py-2.5 text-center leading-snug';
/** A full-width primary / secondary action. */
export const fullLg = `w-full ${wrapLg}`;
