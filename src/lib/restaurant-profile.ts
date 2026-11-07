import { MenuItem } from "./simulation";
export const importedRestaurant = {
  name: "Maple Street Kitchen",
  opening: 11,
  closing: 21,
  orders: 300,
};
export const importedMenu: MenuItem[] = [
  { name: "Classic Burger", price: 14.5, popularity: 0.35 },
  { name: "Burger + Fries Combo", price: 22, popularity: 0.25 },
  { name: "Crispy Chicken Sandwich", price: 15, popularity: 0.2 },
  { name: "Garden Burger", price: 14, popularity: 0.1 },
  { name: "Family Burger Box", price: 45, popularity: 0.1 },
];
export function menuTicket(menu: MenuItem[]) {
  return menu.reduce((sum, item) => sum + item.price * item.popularity, 0);
}
