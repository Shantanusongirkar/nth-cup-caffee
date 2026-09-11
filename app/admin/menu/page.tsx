'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminProduct, AdminProductStats, MenuCategory } from '@/types';
import { formatPaiseToRupees } from '@/utils/whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Coffee,
  AlertCircle,
  Search,
  Package,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  ImagePlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES: MenuCategory[] = ['coffee', 'tea', 'snacks', 'desserts'];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  coffee: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30' },
  tea: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30' },
  snacks: { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/30' },
  desserts: { bg: 'bg-pink-500/10', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-500/30' },
};

interface ProductForm {
  sku: string;
  name: string;
  description: string;
  priceInRupees: string;
  imageUrl: string;
  category: MenuCategory;
  isAvailable: boolean;
}

const EMPTY_FORM: ProductForm = {
  sku: '',
  name: '',
  description: '',
  priceInRupees: '',
  imageUrl: '',
  category: 'coffee',
  isAvailable: true,
};

export default function AdminMenuPage() {
  const [products, setProducts] = React.useState<AdminProduct[]>([]);
  const [stats, setStats] = React.useState<AdminProductStats>({
    totalProducts: 0,
    availableProducts: 0,
    unavailableProducts: 0,
    categories: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState<string>('ALL');

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<AdminProduct | null>(null);
  const [form, setForm] = React.useState<ProductForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<string[]>([]);

  // Image upload state
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProducts = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
      if (data.stats) setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/products');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active) {
          setProducts(data.products || []);
          if (data.stats) setStats(data.stats);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load products.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const openCreateSheet = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormErrors([]);
    setSelectedImageFile(null);
    setImagePreview(null);
    setSheetOpen(true);
  };

  const openEditSheet = (product: AdminProduct) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description,
      priceInRupees: (product.priceInPaise / 100).toString(),
      imageUrl: product.imageUrl || '',
      category: product.category as MenuCategory,
      isAvailable: product.isAvailable,
    });
    setFormErrors([]);
    setSelectedImageFile(null);
    setImagePreview(null);
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors([]);

    const pricePaise = Math.round(parseFloat(form.priceInRupees) * 100);
    if (!pricePaise || pricePaise < 1) {
      setFormErrors(['Price must be a positive number (minimum ₹0.01).']);
      setIsSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      sku: form.sku,
      name: form.name,
      description: form.description,
      priceInPaise: pricePaise,
      category: form.category,
      isAvailable: form.isAvailable,
    };
    if (form.imageUrl.trim()) {
      payload.imageUrl = form.imageUrl.trim();
    }

    try {
      let res: Response;
      if (editingProduct) {
        res = await fetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        const errors = data.details || (data.message ? [data.message] : ['Failed to save product.']);
        setFormErrors(Array.isArray(errors) ? errors : [errors]);
        toast.error(data.message || 'Failed to save product.');
        setIsSubmitting(false);
        return;
      }

      toast.success(editingProduct ? 'Product updated successfully!' : 'Product created successfully!');
      setSheetOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (isUploadingImage) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Unsupported file type. Use JPG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Image is too large. Maximum size is 5 MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setImagePreview(previewUrl);
    setIsUploadingImage(true);

    try {
      const fd = new FormData();
      fd.append('image', file);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.message || 'Failed to upload image.');
      }

      const uploadedUrl: string = data.url;

      setForm((f) => ({ ...f, imageUrl: uploadedUrl }));
      toast.success('Image uploaded.');
    } catch (err) {
      setSelectedImageFile(null);
      setImagePreview(null);
      toast.error(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadImage(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploadingImage) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadImage(file);
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImageFile(null);
    setImagePreview(null);
    setForm((f) => ({ ...f, imageUrl: '' }));
  };

  const handleToggleAvailability = async (product: AdminProduct) => {
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      });

      if (!res.ok) throw new Error('Failed to update.');

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p
        )
      );

      // Update stats
      setStats((prev) => ({
        ...prev,
        availableProducts: product.isAvailable
          ? prev.availableProducts - 1
          : prev.availableProducts + 1,
        unavailableProducts: product.isAvailable
          ? prev.unavailableProducts + 1
          : prev.unavailableProducts - 1,
      }));

      toast.success(`${product.name} is now ${product.isAvailable ? 'unavailable' : 'available'}.`);
    } catch {
      toast.error('Failed to toggle availability.');
    }
  };

  const handleSoftDelete = async (product: AdminProduct) => {
    if (!confirm(`Mark "${product.name}" as unavailable? This can be reversed by toggling availability.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete.');

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, isAvailable: false } : p
        )
      );

      setStats((prev) => ({
        ...prev,
        availableProducts: Math.max(0, prev.availableProducts - 1),
        unavailableProducts: prev.unavailableProducts + 1,
      }));

      toast.success(`${product.name} has been marked as unavailable.`);
    } catch {
      toast.error('Failed to delete product.');
    }
  };

  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, filterCategory, searchQuery]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9" title="Back to Orders">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-foreground tracking-tight">
                Menu Management
              </h1>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                Admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Add, edit, or toggle availability of menu items for your cafe.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/" target="_blank">
            <Button size="sm" variant="ghost" className="rounded-full gap-1 text-xs text-muted-foreground hover:text-foreground">
              <span>View Menu</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
          <Button size="sm" onClick={openCreateSheet} className="rounded-full gap-1.5 text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Items</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-foreground">{stats.totalProducts}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-xs font-medium uppercase tracking-wider">Available</span>
            <Eye className="w-4 h-4" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-emerald-800 dark:text-emerald-200">{stats.availableProducts}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
            <span className="text-xs font-medium uppercase tracking-wider">Unavailable</span>
            <EyeOff className="w-4 h-4" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-amber-800 dark:text-amber-200">{stats.unavailableProducts}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Categories</span>
            <Coffee className="w-4 h-4 text-primary" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-foreground">{stats.categories}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap gap-1.5 bg-muted/60 p-1 rounded-2xl border border-border/50">
          {[
            { id: 'ALL', label: 'All Items', count: products.length },
            ...CATEGORIES.map((cat) => ({
              id: cat,
              label: cat.charAt(0).toUpperCase() + cat.slice(1),
              count: products.filter((p) => p.category === cat).length,
            })),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterCategory === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filterCategory === tab.id ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-full text-xs bg-background border-border"
          />
        </div>
      </div>

      {/* Product List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-6 bg-muted rounded w-2/3" />
              <div className="h-16 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h3 className="font-heading font-bold text-lg text-foreground">Failed to Load Products</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
          <Button onClick={() => { setIsLoading(true); fetchProducts(); }} className="rounded-full px-6 text-xs">
            Try Again
          </Button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-foreground">No Products Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No products match "${searchQuery}". Try clearing your search.`
                : filterCategory !== 'ALL'
                ? `No products in the "${filterCategory}" category.`
                : 'No menu items have been created yet. Click "Add Product" to get started.'}
            </p>
          </div>
          {!searchQuery && filterCategory === 'ALL' && (
            <Button onClick={openCreateSheet} className="rounded-full px-6 text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add First Product
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const catColors = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.coffee;

            return (
              <div
                key={product.id}
                className={`rounded-2xl border bg-card p-4 sm:p-5 shadow-sm transition-all hover:shadow-md ${
                  product.isAvailable ? 'border-border' : 'border-border/50 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Product Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-bold text-base text-foreground">
                        {product.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catColors.bg} ${catColors.text} ${catColors.border}`}
                      >
                        {product.category}
                      </span>
                      {!product.isAvailable && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          <EyeOff className="w-2.5 h-2.5" />
                          Unavailable
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">SKU: {product.sku}</span>
                      <span>{formatPaiseToRupees(product.priceInPaise)}</span>
                      {product._count && product._count.orderItems > 0 && (
                        <span>{product._count.orderItems} orders</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleAvailability(product)}
                      className={`rounded-xl text-xs font-semibold gap-1 ${
                        product.isAvailable
                          ? 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10'
                          : 'text-amber-700 hover:text-amber-800 dark:text-amber-300 hover:bg-amber-500/10'
                      }`}
                      title={product.isAvailable ? 'Mark as unavailable' : 'Mark as available'}
                    >
                      {product.isAvailable ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditSheet(product)}
                      className="rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSoftDelete(product)}
                      className="rounded-xl text-xs font-semibold gap-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Product Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </SheetTitle>
            <SheetDescription>
              {editingProduct ? 'Update the product details below.' : 'Fill in the details to add a new menu item.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            {formErrors.length > 0 && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive space-y-0.5">
                {formErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sku" className="text-xs font-semibold">SKU *</Label>
                <Input
                  id="sku"
                  required
                  placeholder="e.g. coffee-001"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  disabled={isSubmitting || !!editingProduct}
                  className="rounded-xl text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priceInRupees" className="text-xs font-semibold">Price (rupees) *</Label>
                <Input
                  id="priceInRupees"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 180"
                  value={form.priceInRupees}
                  onChange={(e) => setForm((f) => ({ ...f, priceInRupees: e.target.value }))}
                  disabled={isSubmitting}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">Name *</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Classic Cappuccino"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={isSubmitting}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">Description *</Label>
              <Textarea
                id="description"
                rows={3}
                required
                placeholder="Describe the item..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                disabled={isSubmitting}
                className="rounded-xl text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-semibold">Category *</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as MenuCategory }))}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Product Photo <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div
                onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-muted/30 px-3 py-4 text-center cursor-pointer transition-colors ${
                  isUploadingImage
                    ? 'opacity-60 cursor-wait'
                    : 'hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploadingImage}
                />

                {isUploadingImage ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Uploading image...</span>
                  </>
                ) : imagePreview || form.imageUrl ? (
                  <>
                    {/* Local object URLs can't be used with next/image — plain <img> is required here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview || form.imageUrl}
                      alt="Product preview"
                      className="max-h-32 rounded-lg object-cover border border-border/40"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Click to replace or drop a new image
                    </span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-6 h-6 text-muted-foreground/70" />
                    <span className="text-xs font-semibold text-foreground">
                      Click to upload or drag &amp; drop
                    </span>
                    <span className="text-[11px] text-muted-foreground">JPG, PNG or WebP — max 5 MB</span>
                  </>
                )}
              </div>

              {(imagePreview || form.imageUrl) && !isUploadingImage && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] text-muted-foreground truncate pr-2">
                    {selectedImageFile ? selectedImageFile.name : 'Image saved to Blob storage'}
                  </span>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="text-[11px] font-semibold text-destructive hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 py-1">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                  disabled={isSubmitting}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
              </label>
              <Label className="text-xs font-semibold cursor-pointer">
                {form.isAvailable ? 'Available for ordering' : 'Unavailable (hidden from customers)'}
              </Label>
            </div>
          </form>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : editingProduct ? (
                'Update Product'
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Create Product
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
