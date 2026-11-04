import type { Metadata } from "next";
import { MealFinder } from "@/components/premium/meal-finder";
export const metadata: Metadata = {
  title: "Smart Meal Finder",
  description: "Find a chai and paratha meal for your group and your budget.",
};
export default function MealPage() {
  return <MealFinder />;
}
