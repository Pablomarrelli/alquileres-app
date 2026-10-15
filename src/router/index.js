import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

import Propiedades from '../views/Propiedades.vue'
import Login from '../views/Login.vue'

const routes = [
  {
    path: '/login',
    component: Login,
    meta: { requiereAutenticacion: false }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/propiedades',
    component: Propiedades,
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/inquilinos',
    component: () => import('../views/Inquilinos.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/contratos',
    component: () => import('../views/Contratos.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/pagos',
    component: () => import('../views/Pagos.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/servicios',
    component: () => import('../views/Servicios.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/contadores',
    component: () => import('../views/Medidores.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/gastos',
    component: () => import('../views/Gastos.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/documentos',
    component: () => import('../views/Documentos.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/configuracion',
    component: () => import('../views/Configuracion.vue'),
    meta: { requiereAutenticacion: true }
  },
  {
    path: '/ajustes',
    name: 'Ajustes',
    component: () => import('../views/Ajustes.vue'),
    meta: { requiereAutenticacion: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()

  if (to.meta.requiereAutenticacion && !session) {
    return '/login'
  }

  if (to.path === '/login' && session) {
    return '/dashboard'
  }

  return true
})

export default router

