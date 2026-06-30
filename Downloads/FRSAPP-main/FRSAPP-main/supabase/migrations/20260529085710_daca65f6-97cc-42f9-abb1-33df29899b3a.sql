-- Properties
CREATE POLICY "Admins view all properties" ON public.properties FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete all properties" ON public.properties FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Tenants
CREATE POLICY "Admins view all tenants" ON public.tenants FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete all tenants" ON public.tenants FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Caretakers
CREATE POLICY "Admins view all caretakers" ON public.caretakers FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete all caretakers" ON public.caretakers FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Units
CREATE POLICY "Admins view all units" ON public.units FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete all units" ON public.units FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Rent payments
CREATE POLICY "Admins view all rent payments" ON public.rent_payments FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete all rent payments" ON public.rent_payments FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Maintenance issues
CREATE POLICY "Admins view all issues" ON public.maintenance_issues FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete all issues" ON public.maintenance_issues FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Property documents
CREATE POLICY "Admins view all property documents" ON public.property_documents FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete all property documents" ON public.property_documents FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Property images
CREATE POLICY "Admins delete all property images" ON public.property_images FOR DELETE USING (public.has_role(auth.uid(),'admin'));