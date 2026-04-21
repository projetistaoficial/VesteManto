public class Ex09 {
    public static void main(String[] args) {
        double nota1 = 5.0;
        double nota2 = 6.0;
        double media = (nota1 + nota2) / 2.0;

        if (media >= 7.0) {
            System.out.println("Média: " + media + " -> Aprovado direto!");
        } else if (media < 4.0) {
            System.out.println("Média: " + media + " -> Reprovado direto!");
        } else {
            System.out.println("Média: " + media + " -> Aluno em recuperação.");
            
            // Variável simulando o aluno fazendo a prova de recuperação
            double notaRecuperacao = 6.5; 
            double mediaFinal = (media + notaRecuperacao) / 2.0;

            if (mediaFinal >= 5.0) { // Supondo média 5.0 para passar após rec
                System.out.println("Aprovado na recuperação! Nova média: " + mediaFinal);
            } else {
                System.out.println("Reprovado na recuperação. Nova média: " + mediaFinal);
            }
        }
    }
}