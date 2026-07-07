import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, Truck } from 'lucide-react';
import OutlookContactsImporter from '../components/import/OutlookContactsImporter';
import MarketPriceAnalyzer from '../components/import/MarketPriceAnalyzer';
import SupplierBulkImporter from '../components/import/SupplierBulkImporter';

export default function ImportHub() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-1">Import Hub</h1>
        <p className="text-muted-foreground">
          Import contacts from Outlook, analyze market prices with AI, and bulk-import suppliers.
        </p>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList className="bg-card border border-border p-1 h-auto gap-1">
          <TabsTrigger
            value="contacts"
            className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 rounded-lg"
          >
            <Users className="w-4 h-4" />
            Outlook Contacts
          </TabsTrigger>
          <TabsTrigger
            value="prices"
            className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 rounded-lg"
          >
            <TrendingUp className="w-4 h-4" />
            AI Price Analyzer
          </TabsTrigger>
          <TabsTrigger
            value="suppliers"
            className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 rounded-lg"
          >
            <Truck className="w-4 h-4" />
            Supplier Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-6">
          <OutlookContactsImporter />
        </TabsContent>
        <TabsContent value="prices" className="mt-6">
          <MarketPriceAnalyzer />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-6">
          <SupplierBulkImporter />
        </TabsContent>
      </Tabs>
    </div>
  );
}
