import SetSelector from "../../components/SetSelector";

export default function SetSelectorPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Set Selector</h1>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
        Build set parameters using marketplace APIs with searchable dropdowns
      </p>
      <SetSelector />
    </div>
  );
}
